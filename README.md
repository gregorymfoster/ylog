# ylog

A lightweight TypeScript CLI tool that translates GitHub PR history into context for coding agents.

## What is ylog?

ylog creates a structured history of your repository by:
1. Fetching PR data via the GitHub API (using Octokit)
2. Summarizing each PR with AI (Ollama or Anthropic Claude)
3. Storing the results in a SQLite database with optional `.ylog` context files

This allows code generation tools and LLMs to understand *why* your code looks the way it does, not just what it contains.

## Quick Start

```bash
# Install globally
npm install -g @graphite/ylog

# Or use npx
npx @graphite/ylog init

# Initialize with a config file
ylog init

# Fetch and summarize all PRs
ylog sync
```

## Requirements

- Node.js 20+
- GitHub Personal Access Token (PAT) with `repo` scope
- AI provider: Ollama (local) or Anthropic Claude (API key)

## Authentication

ylog supports multiple ways to provide your GitHub token:

1. **Environment variable (recommended):**
   ```bash
   export GITHUB_TOKEN=ghp_your_token_here
   ```

2. **Use existing `gh` CLI token:**
   ```bash
   gh auth login  # if not already authenticated
   ylog sync      # automatically uses gh token
   ```

3. **Config file:**
   ```json
   {
     "github": {
       "token": "ghp_your_token_here"
     }
   }
   ```

4. **CLI flag:**
   ```bash
   ylog sync --github-token ghp_your_token_here
   ```

## Configuration

ylog uses a `ylog.config.js` or `ylog.config.json` file in your repository root:

```javascript
// ylog.config.js
export default {
  github: {
    repo: 'owner/repo',        // Auto-detected from git remote
    token: 'ghp_...',          // Optional, uses hierarchy above
    throttleRpm: 100           // GitHub API rate limit
  },
  ai: {
    provider: 'ollama',        // 'ollama' | 'anthropic'
    model: 'llama3.1:latest',
    endpoint: 'http://localhost:11434',  // Ollama only
    apiKey: 'sk-...',          // Anthropic only
    maxTokens: 100
  },
  concurrency: 10,
  outputDir: '.ylog',
  generateContextFiles: true,   // Create .ylog files for human browsing
  contextFileThreshold: 3,      // Min PRs to generate .ylog
  historyMonths: 6,
  diffMaxBytes: 1048576
};
```

See the [design document](design_doc.md) for full details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

MIT