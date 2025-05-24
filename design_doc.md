ylog – Design Document

Status: Draft – v0.2 (2025-05-24)
MVP focus: Translate PR history → lightweight, in-repo context for code-gen LLMs.
Principle: Keep it stupid-simple today so we can extend tomorrow.

⸻

1 Overview

ylog is a tiny, batteries-included TypeScript CLI that backfills and keeps up-to-date a Why-Log for any GitHub repository. 1. Fetch raw PR metadata via the official gh CLI. 2. Summarise each PR with a local Ollama model. 3. Store results inside the repo at ./ylog/prs.jsonl (append-only) so future coding agents can answer “why does this code look like this?” without hitting the network.

All heavyweight artefacts (raw JSON, diffs) live in a per-machine cache outside the repo. The tool is idempotent, restart-safe, and can be run from CI or a laptop.

⸻

2 Goals & Non-Goals

Goal Non-Goal
Ship in a weekend. Few files, zero classes, no hidden magic. Fancy wiki generation (phase 2).
Pure npm (npx ylog sync). Web UI / IDE plugins.
Extensible via ylog.config.json – choose model, summary length, concurrency, etc. Cross-VCS support.
Handle repos with 50 k+ PRs, auto-resume after crashes. Perfect semantic clustering.

⸻

3 Quick Start

npm i -g @graphite/ylog # or npx ylog …
cd my-repo

# Initialise (writes default ylog.config.json)

ylog init

# Full backfill & incremental sync

ylog sync # idempotent – run anytime

Outcome: ./ylog/prs.jsonl grows; raw cache in ~/.ylog-cache/<owner>/<repo>/.

⸻

4 High-Level Architecture

cli -> config -> orchestrator
| |
v v
ghClient -> cacheManager -> summarizerPool -> jsonlWriter

All modules are pure functions; side-effects are isolated at boundaries.

Concurrency

Default: os.cpus().length workers (max-out local compute). Overridable via config.concurrency.

⸻

5 Configuration (ylog.config.json)

{
"$schema": "https://raw.githubusercontent.com/graphite/ylog/main/config.schema.json",
"github": {
"repo": "withgraphite/monologue",
"tokenEnv": "GITHUB_TOKEN",
"throttleRpm": 400
},
"llm": {
"provider": "ollama",
"model": "mistral:latest",
"endpoint": "http://localhost:11434",
"summaryWords": 40 // default 25; increase for richer context
},
"concurrency": "max", // number | "max"
"cacheDir": "~/.ylog-cache",
"diffMaxBytes": 1048576 // 1 MB; larger diffs truncated with "…"
}

All keys validated by Zod; unknown keys rejected.

⸻

6 Data Flow & Models

6.1 Raw PR Cache (~/.ylog-cache/.../<n>.json)

Direct result of:

gh pr view <n> \
 --json number,title,body,author,mergedAt,files,comments \
 --patch # includes unified diff; truncated if > diffMaxBytes

6.2 Summarised Record (prs.jsonl)

{
"number": 1234,
"mergedAt": "2024-03-01T17:23:00Z",
"author": "alice",
"title": "feat(auth): add session tokens",
"why": "Introduces JWT-backed sessions to prepare for multi-region deployments.",
"areas": ["src/auth", "infra/k8s"],
"files": ["src/auth/*.ts", "infra/k8s/auth.yaml"],
"diffStat": { "add": 420, "del": 17 },
"comments": 3
}

⸻

7 Pipeline Details 1. Pre-flight – ensure gh and ollama executables exist; Node ≥ 20 (enforced via .nvmrc). 2. Checkpoint – read highest PR in prs.jsonl; resume from next = highest+1. 3. Fetch Loop –
• Respect throttleRpm; exponential back-off on secondary rate limits.
• Write raw JSON (+ truncated diff) to cache.
• Stream entry to summarizer queue. 4. Summarizer Pool –
• Construct prompt based on summaryWords.
• POST to Ollama; retry on non-200 or schema fail.
• Validate with Zod and append line to prs.jsonl via atomic write (write temp → rename).

Process exits when no newer PRs.

⸻

8 Folder & Code Style
• Folders: kebab-case (src/cache-manager/).
• Files: camelCase (cacheManager.ts).
• Functional composition > classes; avoid globals; execution context passed explicitly.

Lint & Test
• ESLint + @typescript-eslint, eslint-plugin-functional (no-class/no-this).
• vitest unit + integration; test files live beside source.
• npm run ci – lint, test, build.

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

⸻

11 Testing Matrix (CI)

Job Purpose
unit Node 20 on Ubuntu & macOS.
integration Stub gh & ollama; ensure resumability.
e2e Real gh against octocat/Hello-World; verify ≥1 line in JSONL.

⸻

12 Future Extensions (Phase 2+)
• Generate Markdown wiki per area (auth.md, infra.md).
• Vector embeddings for sem-search.
• VS Code hover/CodeLens.
• Scheduled GitHub Action (cron: nightly) running ylog sync.

⸻

13 Change Log
• v0.2 – added truncation rule, configurable summary length, max concurrency, MIT licence, Node 20 requirement, simplicity emphasis.
• v0.1 – initial draft.

⸻

14 Contact

Maintainer: Greg @ Graphite – opens issues/PRs on GitHub.

⸻

End of document
