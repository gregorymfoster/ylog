# ylog

A lightweight TypeScript CLI tool that translates GitHub PR history into context for coding agents.

## What is ylog?

ylog creates a structured history of your repository by:
1. Fetching PR data via the GitHub CLI (`gh`)
2. Summarizing each PR with a local Ollama model
3. Storing the results in an append-only `./ylog/prs.jsonl` file

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
- GitHub CLI (`gh`) installed and authenticated
- Ollama running locally (default) or accessible via network

## Configuration

ylog uses a `ylog.config.json` file in your repository root:

```json
{
  "github": {
    "repo": "owner/repo",
    "tokenEnv": "GITHUB_TOKEN",
    "throttleRpm": 400
  },
  "llm": {
    "provider": "ollama",
    "model": "mistral:latest",
    "endpoint": "http://localhost:11434",
    "summaryWords": 40
  },
  "concurrency": "max",
  "cacheDir": "~/.ylog-cache",
  "diffMaxBytes": 1048576
}
```

See the [design document](design_doc.md) for full details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

MIT