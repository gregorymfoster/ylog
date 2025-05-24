# Claude Guidelines for ylog

## Project Overview
ylog is a TypeScript CLI tool that converts GitHub PR history into structured context that can be stored in a codebase for LLMs to use. It:
1. Auto-detects GitHub repo from git remote
2. Fetches PR data using the GitHub CLI (`gh`)
3. Summarizes PRs using AI (Ollama or Anthropic via Vercel AI SDK)
4. Stores results in a local SQLite database with easy querying

## Architecture Guidelines
- Follow the architecture in `design_doc.md` precisely
- Keep the codebase simple, modular, and functional
- Focus on the core pipeline: fetch → cache → summarize → write JSONL

## Code Style Rules
- **Folders**: Use kebab-case (e.g., `src/cache-manager/`)
- **Files**: Use camelCase (e.g., `cacheManager.ts`)
- **Types**: Use `type` declarations over `interface` declarations
- **Programming Paradigm**: 
  - Use functional programming, not OOP
  - No classes or inheritance
  - No `this` keyword
  - Prefer composition over inheritance
  - Avoid globals, pass execution context as parameters
  - Simple try/catch error handling (no Result pattern for MVP)
  - Minimal dependency injection for core functionality
- **Tests**: Each file should have a companion `.test.ts` file in the same directory
- **Node**: Target Node.js 20+ (enforced via `.nvmrc`)
- **Imports**: Use `.js` extensions in relative imports (ES module standard)

## Project Structure
```
src/
├── cli/                # CLI entry point & commands (init, sync)
│   ├── index.ts        # Main CLI entry
│   ├── commands/       # Individual command implementations
│   └── cli.test.ts
├── config/             # Configuration validation & loading
│   ├── schema.ts       # Zod schemas for validation
│   ├── loader.ts       # Config file loading/validation
│   └── config.test.ts
├── gh-client/          # GitHub CLI wrapper & rate limiting
│   ├── ghClient.ts     # GitHub CLI wrapper
│   ├── rateLimiter.ts  # Rate limiting logic
│   └── ghClient.test.ts
├── cache-manager/      # File-based caching with atomic operations
│   ├── cacheManager.ts # File-based caching
│   ├── atomicWriter.ts # Atomic file operations
│   └── cacheManager.test.ts
├── summarizer/         # Ollama integration & prompt templates
│   ├── ollamaClient.ts # Ollama API integration
│   ├── promptTemplates.ts # Prompt engineering
│   └── summarizer.test.ts
├── jsonl-writer/       # JSONL output & resume tracking
│   ├── jsonlWriter.ts  # JSONL file management
│   ├── resumeTracker.ts # Resume from last PR
│   └── jsonlWriter.test.ts
├── orchestrator/       # Main pipeline & concurrency control
│   ├── pipeline.ts     # Main processing pipeline
│   ├── concurrency.ts  # Worker pool management
│   └── orchestrator.test.ts
├── types/              # TypeScript type definitions
│   ├── config.ts       # Configuration types
│   ├── github.ts       # GitHub API response types
│   ├── summary.ts      # Summary/JSONL record types
│   └── index.ts        # Re-exports
└── utils/              # Utilities & preflight checks
    ├── preflight.ts    # Dependency checks
    ├── logger.ts       # Structured logging
    └── utils.test.ts
```

## Development Workflow
```bash
# Install dependencies
npm install

# Run tests
npm test

# Lint code (using oxlint for speed)
npm run lint

# Type check
npm run typecheck

# Format code
npm run format

# Full CI check
npm run ci

# Build the project
npm run build

# Run the CLI locally
npm run dev init
npm run dev sync
```

## Tooling Preferences
- **Linting**: Use oxlint instead of ESLint for ~100x faster linting
- **Type Checking**: Use `tsc --noEmit` for TypeScript validation
- **Development**: Use tsx for fast TypeScript execution
- **Building**: Use tsup for efficient bundling
- **Testing**: Use vitest for fast testing with comprehensive coverage
- **Formatting**: Use prettier for consistent code style
- **Git Hooks**: Use husky for pre-commit quality gates

### Speed Optimizations Applied
- Replaced ESLint with oxlint (Rust-based, much faster)
- Removed all ESLint dependencies to reduce node_modules size
- Streamlined devDependencies from 10 to 8 packages
- Configured oxlint.json for project-specific rules
- Pre-commit hooks ensure main branch stays green

## Key Coding Patterns

### Functional Pipeline Architecture
```typescript
// Each stage is a pure function that takes context + data
type PipelineStage<TInput, TOutput> = (
  context: ProcessingContext,
  input: TInput
) => Promise<TOutput>;

// Main pipeline composition
const processPR = pipe(
  fetchPRData,
  cacheRawData,
  summarizeWithLLM,
  appendToJSONL
);
```

### Result/Either Pattern for Error Handling
```typescript
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

// All functions return Results instead of throwing
const fetchPR = async (prNumber: number): Promise<Result<RawPR>> => {
  try {
    const data = await ghClient.fetchPR(prNumber);
    return { success: true, data };
  } catch (error) {
    return { success: false, error };
  }
};
```

### Dependency Injection for Testability
```typescript
type Dependencies = {
  execaFn: typeof execa;
  fetchFn: typeof fetch;
  fsFn: typeof fs;
};

export const createGhClient = (deps: Partial<Dependencies> = {}): GhClient => {
  const { execaFn = execa, fsFn = fs } = deps;
  // Implementation uses injected dependencies
};
```

## Testing Strategy

### Multi-layered Testing Approach
1. **Unit Tests**: Fast, isolated with mocked dependencies
2. **Integration Tests**: Real file system, temp directories
3. **Contract Tests**: External API shape validation
4. **E2E Tests**: Full system including real OSS repos
5. **Performance Tests**: Large repo handling & rate limit compliance

### Key Test Patterns
- Mock factories for consistent test data
- Dependency injection for testability
- Temp directories for integration tests
- Real-world e2e tests against popular OSS repos (microsoft/vscode, etc.)
- Error scenario testing with network failures

### Test Commands
```bash
npm run test           # Unit tests
npm run test:integration # Integration tests
npm run test:e2e       # End-to-end tests
npm run test:e2e:real-world # Real OSS repo tests
```

## Implementation Priorities

### Phase 1 - Core Foundation
1. Config validation with Zod (ylog.config.json)
2. CLI structure with commander.js (`init`, `sync` commands)
3. Pre-flight checks (gh CLI, Ollama, Node version)

### Phase 2 - Data Pipeline
4. GitHub client via `gh` CLI with rate limiting
5. File-based caching system with atomic operations
6. JSONL writer with resumability

### Phase 3 - LLM Integration
7. Ollama client with prompt templates focused on "why"
8. Parallel processing with configurable concurrency
9. Error handling and retry logic

### Phase 4 - Polish
10. Comprehensive error handling
11. Progress indicators and logging
12. End-to-end testing

Follow the principles in the design document: keep it simple, idempotent, and ready to extend.