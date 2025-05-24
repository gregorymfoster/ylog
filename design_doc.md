ylog – Design Document

Status: Draft – v0.5 (2025-05-24)
MVP focus: Translate PR history → lightweight, in-repo context for code-gen LLMs.
Principle: Keep it stupid-simple today so we can extend tomorrow.

⸻

1 Overview

ylog is a tiny, batteries-included TypeScript CLI that backfills and keeps up-to-date a Why-Log for any GitHub repository. 1. Auto-detect GitHub repo from git remote. 2. Fetch raw PR metadata via the official gh CLI. 3. Summarise each PR with AI (Ollama or Anthropic via Vercel AI SDK). 4. Store results in a local SQLite database (./ylog/prs.db) so future coding agents can answer "why does this code look like this?" without hitting the network.

Raw PR data is cached locally outside the repo. The tool is idempotent, restart-safe, and can be run from CI or a laptop. SQLite provides ACID transactions and easy querying for future features.

⸻

2 Goals & Non-Goals

Goal | Non-Goal
Ship in a weekend. Few files, zero classes, no hidden magic. | Fancy wiki generation (phase 2).
Pure npm (npx ylog sync). | Web UI / IDE plugins.
Extensible via ylog.config.json – choose model, provider, concurrency, etc. | Cross-VCS support.
Handle repos with 50k+ PRs, auto-resume after crashes. | Perfect semantic clustering.

⸻

3 Quick Start

```bash
npm i -g @graphite/ylog # or npx ylog …
cd my-repo

# Initialize (writes default ylog.config.json)
ylog init

# Full backfill & incremental sync
ylog sync # idempotent – run anytime
```

Outcome: ./ylog/prs.db grows; raw cache in ~/.ylog-cache/<owner>/<repo>/.

⸻

4 Simplified Architecture

```
cli -> core pipeline
|
v
ghClient -> cacheManager -> aiClient -> sqliteStorage
```

All modules are pure functions; side-effects are isolated at boundaries.

**Concurrency:** Default 10 workers. Overridable via config.concurrency.

⸻

5 Configuration (ylog.config.json)

```json
{
  "$schema": "https://raw.githubusercontent.com/graphite/ylog/main/config.schema.json",
  "github": {
    "repo": "auto-detect", // Auto-detected from git remote origin
    "throttleRpm": 100
  },
  "ai": {
    "provider": "ollama", // "ollama" | "anthropic"
    "model": "mistral:latest",
    "endpoint": "http://localhost:11434", // For Ollama
    "apiKey": "$ANTHROPIC_API_KEY", // For Anthropic
    "maxTokens": 100
  },
  "concurrency": 10,
  "outputFile": "./ylog/prs.db",
  "cacheDir": "~/.ylog-cache",
  "diffMaxBytes": 1048576
}
```

All keys validated by Zod; unknown keys rejected.

⸻

6 Data Flow & Models

6.1 Raw PR Cache (~/.ylog-cache/.../<n>.json)

Direct result of:
```bash
gh pr view <n> \
 --json number,title,body,author,mergedAt,files,comments \
 --patch # includes unified diff; truncated if > diffMaxBytes
```

6.2 Key Data Structures

**Configuration Type:**
```typescript
type YlogConfig = {
  github?: {
    repo?: string; // Auto-detect from git remote if not provided
    throttleRpm?: number; // Default 100
  };
  ai: {
    provider: 'ollama' | 'anthropic';
    model: string;
    apiKey?: string; // For Anthropic
    endpoint?: string; // For Ollama, default 'http://localhost:11434'
    maxTokens?: number; // Default 100
  };
  concurrency?: number; // Default 10
  outputFile?: string; // Default './ylog/prs.db'
  cacheDir?: string; // Default '~/.ylog-cache'
  diffMaxBytes?: number; // Default 1MB
};
```

**SQLite Schema:**
```sql
CREATE TABLE prs (
  number INTEGER PRIMARY KEY,
  merged_at TEXT,
  author TEXT,
  title TEXT,
  why TEXT,
  areas TEXT, -- JSON array as text
  files TEXT, -- JSON array as text  
  diff_add INTEGER,
  diff_del INTEGER,
  comments INTEGER
);
```

**Example Record:**
```sql
INSERT INTO prs VALUES (
  1234,
  '2024-03-01T17:23:00Z',
  'alice',
  'feat(auth): add session tokens',
  'Introduces JWT-backed sessions to prepare for multi-region deployments.',
  '["src/auth", "infra/k8s"]',
  '["src/auth/*.ts", "infra/k8s/auth.yaml"]',
  420,
  17,
  3
);
```

**Dependencies:**
```typescript
type Dependencies = {
  database: Database; // better-sqlite3
  aiClient: (prData: RawPR) => Promise<string>;
  ghClient: (prNumber: number) => Promise<RawPR>;
  cacheManager: (prNumber: number, data: RawPR) => Promise<void>;
};
```

⸻

7 Pipeline Details 

**Pre-flight Checks:**
• Ensure `gh` CLI installed and authenticated (fail fast if missing)
• Ensure AI provider accessible (Ollama running or Anthropic API key valid)
• Auto-detect GitHub repo from `git remote get-url origin`
• Verify Node ≥ 20 (enforced via .nvmrc)

**Resumability & Idempotence:**
• SQLite query: `SELECT MAX(number) FROM prs` to resume from last PR
• Skip PRs already cached (check cache files exist)
• ACID transactions eliminate need for atomic file operations

**Fetch Loop (GitHub via `gh` CLI):**
• Respect throttleRpm with exponential backoff on rate limits
• Handle network failures with retries and graceful degradation
• Write raw JSON (+ truncated diff) to cache before processing
• Designed for repos with tens of thousands of PRs

**AI Summarization (Vercel AI SDK):**
• Support Ollama and Anthropic via unified interface
• Construct prompts focusing on "why" with enough "what" for code linking
• Handle minimal PR descriptions with best effort
• Parallel processing up to concurrency limit

**Error Strategy:**
• Idempotent: safe to restart anytime
• Parallelizable: multiple workers can run safely
• Fail fast: missing dependencies stop execution immediately

Process exits when no newer PRs available.

⸻

8 Simplified Project Structure

```
src/
├── cli/           # Commands (init, sync)
├── core/          # Main business logic  
├── adapters/      # aiClient.ts, ghClient.ts
├── storage/       # SQLite database operations
└── types/         # Type definitions
```

**Coding Style:**
• Folders: kebab-case (src/adapters/)
• Files: camelCase (aiClient.ts)
• Use `type` declarations over `interface`
• Functional composition > classes; avoid globals
• Pass execution context explicitly as parameters
• Simple try/catch error handling (no Result pattern for MVP)

**Key Dependencies:**
• `ai` + `@ai-sdk/anthropic` + `ollama-ai-provider` for AI
• `better-sqlite3` for database
• `commander` for CLI
• `zod` for validation
• `execa` for subprocess execution

**Testing Strategy:**
• Unit tests: Core logic with mocked dependencies
• One integration test: Full sync with real OSS repo
• Simple testing approach for weekend MVP

⸻

9 Build & Release
• Bundled with tsup to dist/ (ESM).
• bin entry → dist/cli.js (shebang).
• Publish via npm publish --access public.

License: MIT (OSI-approved, permissive).

⸻

10 Security & Privacy
• Raw cache lives outside repo, avoiding accidental commit.
• Summaries may leak sensitive insights; README will warn users & suggest private branches if needed.
• API keys stored in environment variables, not config files.

⸻

11 Future Extensions (Phase 2+)
• Query interface: "show me all auth-related PRs" via SQL
• Generate Markdown wiki per area (auth.md, infra.md).
• Vector embeddings for semantic search.
• VS Code hover/CodeLens.
• Scheduled GitHub Action (cron: nightly) running ylog sync.

⸻

12 Change Log
• v0.5 – SQLite storage, Vercel AI SDK integration, auto-detect GitHub repo, simplified architecture (5 modules vs 9), reduced testing complexity for MVP.
• v0.4 – detailed project structure, comprehensive testing strategy including real-world e2e tests, coding patterns (types over interfaces, Result pattern), dependency injection approach.
• v0.3 – clarified error handling strategy (fail fast for dependencies), detailed resumability approach, updated concurrency defaults, switched to oxlint for performance, added pre-commit hooks.
• v0.2 – added truncation rule, configurable summary length, max concurrency, MIT licence, Node 20 requirement, simplicity emphasis.
• v0.1 – initial draft.

⸻

13 Contact

Maintainer: Greg @ Graphite – opens issues/PRs on GitHub.

⸻

End of document