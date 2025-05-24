# Claude Guidelines for ylog

## Project Overview
ylog is a TypeScript CLI tool that converts GitHub PR history into structured context that can be stored in a codebase for LLMs to use. It:
1. Fetches PR data using the GitHub CLI (`gh`)
2. Summarizes PRs using Ollama LLMs
3. Creates an append-only JSONL file with PR summaries and metadata

## Architecture Guidelines
- Follow the architecture in `design_doc.md` precisely
- Keep the codebase simple, modular, and functional
- Focus on the core pipeline: fetch → cache → summarize → write JSONL

## Code Style Rules
- **Folders**: Use kebab-case (e.g., `src/cache-manager/`)
- **Files**: Use camelCase (e.g., `cacheManager.ts`)
- **Programming Paradigm**: 
  - Use functional programming, not OOP
  - No classes or inheritance
  - No `this` keyword
  - Prefer composition over inheritance
  - Avoid globals, pass execution context as parameters
- **Tests**: Each file should have a companion `.test.ts` file in the same directory
- **Node**: Target Node.js 20+ (enforced via `.nvmrc`)

## Project Structure
- `/src`: Source code
- `/src/cli`: Command-line interface
- `/src/config`: Configuration management
- `/src/gh-client`: GitHub client functionality
- `/src/cache-manager`: PR data caching
- `/src/summarizer`: Ollama integration for summarization
- `/src/jsonl-writer`: Writing to the append-only JSONL file
- `/src/orchestrator`: Coordinating the pipeline
- `/src/types`: TypeScript type definitions
- `/src/utils`: Utility functions

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
- **Testing**: Use vitest for fast testing
- **Formatting**: Use prettier for consistent code style

### Speed Optimizations Applied
- Replaced ESLint with oxlint (Rust-based, much faster)
- Removed all ESLint dependencies to reduce node_modules size
- Streamlined devDependencies from 10 to 7 packages
- Configured oxlint.json for project-specific rules

## Implementation Priorities
1. Core config validation with Zod
2. GitHub CLI integration with proper throttling
3. Local caching system for PR data
4. Ollama integration for summarization
5. JSONL file management
6. Orchestration with proper concurrency

Follow the principles in the design document: keep it simple, idempotent, and ready to extend.