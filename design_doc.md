ylog – Design Document

Status: Draft – v0.6 (2025-05-24)
MVP focus: Translate PR history → lightweight, in-repo context for code-gen LLMs.
Principle: Keep it stupid-simple today so we can extend tomorrow.

⸻

1 Overview

ylog is a tiny, batteries-included TypeScript CLI that creates "Institutional Memory" for dev teams by converting GitHub PR history into discoverable context. 1. Auto-detect GitHub repo from git remote. 2. Fetch raw PR metadata via the official gh CLI. 3. Summarise each PR with AI (Ollama or Anthropic via Vercel AI SDK). 4. Store structured data in SQLite database and generate contextual .ylog files throughout the codebase for easy discovery.

Raw PR data is cached locally outside the repo. The tool generates both structured data (SQLite) for rich querying and contextual files (.ylog) for easy discovery while browsing code. Tool is idempotent, restart-safe, and can be run from CI or a laptop.

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

Outcome: ./ylog/prs.db grows; contextual .ylog files appear near relevant code; raw cache in ~/.ylog-cache/<owner>/<repo>/.

⸻

4 Simplified Architecture

```
cli -> core pipeline
|
v
ghClient -> cacheManager -> aiClient -> sqliteStorage -> contextFileGenerator
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
  "outputDir": "./ylog", // prs.db + optional HISTORY.md
  "generateContextFiles": true, // Create .ylog files near code
  "contextFileThreshold": 3, // Min PRs to generate .ylog file
  "historyMonths": 6, // How far back for contextual files
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
  outputDir?: string; // Default './ylog' (contains prs.db + HISTORY.md)
  generateContextFiles?: boolean; // Default true - create .ylog files
  contextFileThreshold?: number; // Default 3 - min PRs to generate .ylog
  historyMonths?: number; // Default 6 - timeframe for contextual files
  cacheDir?: string; // Default '~/.ylog-cache'
  diffMaxBytes?: number; // Default 1MB
};
```

**Enhanced SQLite Schema:**
```sql
CREATE TABLE prs (
  -- Core GitHub data
  number INTEGER PRIMARY KEY,
  title TEXT,
  body TEXT, -- Store original for re-processing
  author TEXT,
  created_at TEXT,
  merged_at TEXT,
  
  -- Rich metadata
  reviewers TEXT, -- JSON: ["alice", "bob"]
  labels TEXT, -- JSON: ["bug", "feature"]
  linked_issues TEXT, -- JSON: [123, 456]
  files_changed TEXT, -- JSON with file paths and stats
  base_branch TEXT,
  head_branch TEXT,
  
  -- LLM-generated content
  why TEXT, -- AI summary focusing on "why"
  business_impact TEXT, -- Why was this needed?
  technical_changes TEXT, -- What was implemented?
  areas TEXT, -- Affected code areas: ["src/auth", "infra"]
  
  -- Quality & provenance
  llm_model TEXT, -- "anthropic/claude-3" or "ollama/mistral"
  confidence_score REAL, -- 0.0-1.0 if available
  human_reviewed BOOLEAN DEFAULT FALSE,
  schema_version INTEGER DEFAULT 1,
  processed_at TEXT,
  
  -- Legacy stats
  diff_add INTEGER,
  diff_del INTEGER,
  comments INTEGER
);

-- Indexes for common queries
CREATE INDEX idx_author ON prs(author);
CREATE INDEX idx_areas ON prs(areas);
CREATE INDEX idx_labels ON prs(labels);
CREATE INDEX idx_merged_at ON prs(merged_at);
```

**Example Record:**
```sql
INSERT INTO prs VALUES (
  1234,
  'feat(auth): add session tokens',
  'This PR introduces JWT-based session management to replace our current cookie-based approach...',
  'alice',
  '2024-02-28T10:00:00Z',
  '2024-03-01T17:23:00Z',
  '["bob", "charlie"]', -- reviewers
  '["enhancement", "auth"]', -- labels
  '[456, 789]', -- linked issues
  '[{"path": "src/auth/jwt.ts", "additions": 200, "deletions": 0}, {"path": "src/auth/session.ts", "additions": 150, "deletions": 50}]',
  'main',
  'feature/jwt-sessions',
  'Introduces JWT-backed sessions to prepare for multi-region deployments',
  'Required for scaling to multiple data centers while maintaining user session state',
  'Adds JWT token generation, validation, and refresh mechanisms. Replaces cookie-based sessions with stateless tokens.',
  '["src/auth", "infrastructure"]',
  'anthropic/claude-3-haiku',
  0.85,
  FALSE,
  1,
  '2024-03-01T18:00:00Z',
  350, 67, 3
);
```

**Output Strategy:**
ylog generates both structured data and human-readable context:

1. **SQLite Database** (`./ylog/prs.db`): Structured, queryable data for tools and rich analysis
2. **Contextual Files** (`src/auth/.ylog`, `infrastructure/.ylog`): Human-readable history files placed near relevant code
3. **Central Overview** (`./ylog/HISTORY.md`): Optional chronological summary

**Example Contextual File** (`src/auth/.ylog`):
```markdown
<!-- Auto-generated by ylog. Do not edit. Regenerate with: ylog sync --area src/auth -->

# Development History: src/auth/

## Recent Changes (Last 6 months)

**🔐 JWT Token Migration** - [PR #1234](link) by @alice • 2024-03-01
*Introduces JWT-backed sessions to prepare for multi-region deployments. Replaces cookie-based auth with stateless tokens.*

**🐛 Fix Session Timeout** - [PR #1189](link) by @bob • 2024-02-15
*Resolves race condition in session cleanup that caused users to be logged out unexpectedly during high traffic.*

## Key Contributors
- @alice (2 PRs): JWT migration, performance improvements
- @bob (1 PR): Session timeout fixes

---
*Generated from ylog database • [Query this area](ylog show src/auth)*
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
• Generate multiple summary types: why, business_impact, technical_changes
• Handle minimal PR descriptions with best effort
• Store provenance: model used, confidence scores, human review status
• Parallel processing up to concurrency limit

**Context File Generation:**
• Generate .ylog files in directories with ≥3 PRs touching them
• Focus on recent history (configurable months back)
• Human-readable format with PR summaries, contributors, and impact areas
• Clearly marked as auto-generated with regeneration instructions

**Error Strategy:**
• Idempotent: safe to restart anytime
• Parallelizable: multiple workers can run safely
• Fail fast: missing dependencies stop execution immediately

Process exits when no newer PRs available.

⸻

8 Simplified Project Structure

```
src/
├── cli/           # Commands (init, sync, show, generate)
├── core/          # Main business logic  
├── adapters/      # aiClient.ts, ghClient.ts
├── storage/       # SQLite database operations + context file generation
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

11 CLI Commands & Usage

**Core Commands:**
```bash
ylog init                         # Initialize config, create ylog directory
ylog sync                         # Full sync: update DB + regenerate context files
ylog show src/auth                # Query specific area
ylog show --author alice          # Show changes by author  
ylog show --since "2024-01-01"    # Time-based queries
ylog generate src/auth            # Regenerate .ylog file for specific area
ylog clean                        # Remove all .ylog files (keep database)
```

**Query Examples:**
```bash
ylog show src/auth --format=json          # Structured output
ylog show --labels bug,critical           # Filter by PR labels
ylog show --reviewers alice,bob           # Filter by reviewers
ylog search "JWT" "authentication"       # Search across summaries
```

⸻

12 Future Extensions (Phase 2+)
• Human review workflow: mark summaries as reviewed/corrected
• Confidence scoring and quality indicators
• Export formats: JSON, Markdown, CSV for integration
• Additional AI providers via Vercel AI SDK
• Vector embeddings for semantic search
• VS Code hover/CodeLens integration
• GitHub Action for automated sync
• Team insights and analytics dashboard

⸻

13 Change Log
• v0.6 – Enhanced schema with rich metadata, hybrid output strategy (SQLite + contextual .ylog files), CLI commands for querying, positioning as "Institutional Memory" tool.
• v0.5 – SQLite storage, Vercel AI SDK integration, auto-detect GitHub repo, simplified architecture (5 modules vs 9), reduced testing complexity for MVP.
• v0.4 – detailed project structure, comprehensive testing strategy including real-world e2e tests, coding patterns (types over interfaces, Result pattern), dependency injection approach.
• v0.3 – clarified error handling strategy (fail fast for dependencies), detailed resumability approach, updated concurrency defaults, switched to oxlint for performance, added pre-commit hooks.
• v0.2 – added truncation rule, configurable summary length, max concurrency, MIT licence, Node 20 requirement, simplicity emphasis.
• v0.1 – initial draft.

⸻

14 Contact

Maintainer: Greg @ Graphite – opens issues/PRs on GitHub.

⸻

End of document