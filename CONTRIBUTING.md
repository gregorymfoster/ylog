# Contributing to ylog

Thank you for considering contributing to ylog! This document outlines the guidelines for contributing to this project.

## Development Setup

1. Ensure you have Node.js 20+ installed (use nvm for managing Node versions)
2. Clone the repository
3. Install dependencies: `npm install`
4. Run tests: `npm test`

## Code Style and Structure

### Naming Conventions
- **Folders**: Use kebab-case (e.g., `src/cache-manager/`)
- **Files**: Use camelCase (e.g., `cacheManager.ts`)

### Programming Paradigm
- Use functional programming principles
- No classes or inheritance
- Avoid the `this` keyword
- No global state; pass execution context as parameters
- Use composition over inheritance
- Functions should be pure when possible

### Testing
- Tests should live next to the files they're testing (`file.ts` and `file.test.ts`)
- Use vitest for writing tests
- Aim for high test coverage, especially for core functionality

### Linting and Formatting
- Run `npm run lint` to check for linting issues (using oxlint for speed)
- Run `npm run typecheck` to validate TypeScript types
- Run `npm run format` to format code according to the project's style
- Run `npm run ci` to run the full CI pipeline locally

## Git Workflow

### Branching
- Create feature branches from `main`
- Use descriptive branch names (`feature/add-ollama-config`, `fix/gh-rate-limit`)

### Commits
- Write clear, concise commit messages
- Follow conventional commits format when possible: 
  - `feat: add support for custom Ollama endpoint`
  - `fix: handle GitHub API rate limiting`
  - `docs: improve README examples`

### Pull Requests
- Create PRs against the `main` branch
- Fill out the PR template completely
- Ensure all CI checks pass before requesting review

## Running the Project Locally

```bash
# Build the project
npm run build

# Run commands
npm run dev init
npm run dev sync

# For development with auto-reload
npm run dev:watch
```

## Definition of Done

Before considering a feature complete, ensure:
1. All tests pass (`npm run test`)
2. Linting passes (`npm run lint`)
3. Type checking passes (`npm run typecheck`)
4. Full CI pipeline passes (`npm run ci`)
5. The feature is documented in the README (if user-facing)
6. The feature follows the design document's architecture
7. The implementation is simple and maintainable

## License

By contributing to ylog, you agree that your contributions will be licensed under the project's MIT license.