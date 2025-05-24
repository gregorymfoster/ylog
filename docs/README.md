# ylog Documentation

This directory contains Mintlify documentation for ylog.

## Setup

1. Install Mintlify CLI:
   ```bash
   npm install -g mintlify
   ```

2. Start development server:
   ```bash
   mintlify dev
   ```

3. Open browser to `http://localhost:3000`

## Structure

- `mint.json` - Mintlify configuration
- `*.mdx` - Documentation pages
- `concepts/` - Core concept explanations
- `cli/` - Command-line interface documentation
- `authentication/` - Authentication guides
- `configuration/` - Configuration reference

## Deployment

Mintlify automatically deploys from the main branch. No additional setup required.

## Contributing

When adding new pages:

1. Create the `.mdx` file in the appropriate directory
2. Add the page to `mint.json` navigation
3. Use consistent frontmatter format
4. Include code examples and practical guidance