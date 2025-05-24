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
- Use `type` declarations over `interface` declarations
- Use Result/Either pattern for error handling instead of throwing
- Implement dependency injection for testability

### Testing

**Test Organization:**
- Tests should live next to the files they're testing (`file.ts` and `file.test.ts`)
- Use vitest for writing tests
- Aim for high test coverage, especially for core functionality

**Testing Layers:**
1. **Unit Tests**: Fast, isolated with mocked dependencies
   - Mock external dependencies using dependency injection
   - Test pure functions and business logic
   - Use Result pattern validation

2. **Integration Tests**: Real file system operations
   - Use temp directories for file operations
   - Test atomic write operations
   - Verify caching behavior

3. **Contract Tests**: External API compatibility
   - Test GitHub API (Octokit) response handling
   - Test AI provider API response handling (Ollama/Anthropic)
   - Validate data structure contracts

4. **E2E Tests**: Full system verification
   - Test against real OSS repositories (microsoft/vscode, sindresorhus/got)
   - Verify resumability and idempotence
   - Test with real AI providers and GitHub API
   - Test GitHub token authentication methods

5. **Performance Tests**: Scalability verification
   - Test large repository handling
   - Verify rate limiting compliance
   - Test concurrency bounds

**Test Commands:**
```bash
npm run test                    # Unit tests only
npm run test:integration        # Integration tests
npm run test:e2e               # End-to-end tests
npm run test:e2e:real-world    # Real OSS repository tests
npm run test:performance       # Performance and load tests
npm run test:all               # All test suites
```

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

# Testing during development
npm run test:watch             # Watch mode for unit tests
npm run test:integration        # Run integration tests
npm run test:e2e               # Run e2e tests (requires Ollama)
```

## Definition of Done

Before considering a feature complete, ensure:
1. **Code Quality:**
   - All unit tests pass (`npm run test`)
   - Integration tests pass where applicable
   - Linting passes (`npm run lint`)
   - Type checking passes (`npm run typecheck`)
   - Full CI pipeline passes (`npm run ci`)

2. **Testing Coverage:**
   - Unit tests for all pure functions
   - Integration tests for file operations
   - E2E tests for user-facing features
   - Error scenarios tested (network failures, missing dependencies)

3. **Documentation:**
   - The feature is documented in the README (if user-facing)
   - Code includes appropriate type annotations
   - Complex logic has clear function signatures

4. **Architecture Compliance:**
   - The feature follows the design document's architecture
   - Uses Result pattern for error handling
   - Implements dependency injection where needed
   - Follows functional programming principles

5. **Maintainability:**
   - The implementation is simple and maintainable
   - No classes or inheritance used
   - Pure functions where possible
   - Clear separation of concerns

## License

By contributing to ylog, you agree that your contributions will be licensed under the project's MIT license.