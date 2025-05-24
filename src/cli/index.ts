#!/usr/bin/env node

/**
 * ylog CLI entry point with full commander.js setup
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { detectGitHubRepo } from '../core/config.js';

// Get package.json for version
const packagePath = join(__dirname, '../package.json');

let version = '0.0.0';
try {
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
  version = packageJson.version;
} catch {
  // Fallback version if package.json not found
}

const program = new Command();

program
  .name('ylog')
  .description('Convert GitHub PR history into institutional memory')
  .version(version);

// Init command with config generation
program
  .command('init')
  .description('Initialize ylog configuration')
  .option('-f, --force', 'Overwrite existing configuration')
  .option('--provider <provider>', 'AI provider (ollama|anthropic)', 'ollama')
  .option('--model <model>', 'AI model name', 'llama3.2')
  .action(async (options) => {
    try {
      const configPath = 'ylog.config.json';
      
      if (existsSync(configPath) && !options.force) {
        console.error('Configuration already exists. Use --force to overwrite.');
        process.exit(1);
      }

      // Auto-detect GitHub repo
      let githubRepo = '';
      try {
        githubRepo = await detectGitHubRepo();
        console.log(`Detected GitHub repository: ${githubRepo}`);
      } catch {
        console.log('Could not auto-detect GitHub repository. Please set manually in config.');
      }

      // Generate configuration
      const config = {
        github: {
          repo: githubRepo,
          throttleRpm: 100
        },
        ai: {
          provider: options.provider,
          model: options.model,
          ...(options.provider === 'anthropic' && {
            apiKey: 'YOUR_ANTHROPIC_API_KEY'
          }),
          ...(options.provider === 'ollama' && {
            endpoint: 'http://localhost:11434'
          })
        },
        concurrency: 10,
        outputDir: '.ylog',
        generateContextFiles: true,
        contextFileThreshold: 50,
        historyMonths: 6,
        cacheDir: '.ylog/cache',
        diffMaxBytes: 1000000
      };

      writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(`Configuration written to ${configPath}`);
      
      if (options.provider === 'anthropic') {
        console.log('\nRemember to set your Anthropic API key in the config file or ANTHROPIC_API_KEY environment variable.');
      }
      
      console.log('\nNext steps:');
      console.log('1. Review and adjust the configuration as needed');
      console.log('2. Run "ylog sync" to start syncing PR history');
      
    } catch (error) {
      console.error('Failed to initialize configuration:', error);
      process.exit(1);
    }
  });

program
  .command('sync')
  .description('Sync PR history and generate context')
  .option('-c, --config <path>', 'Configuration file path')
  .option('--dry-run', 'Show what would be synced without making changes')
  .action(() => {
    console.log('ylog sync - implementation coming in milestone 4.2');
  });

program
  .command('show')
  .description('Query and display PR history')
  .option('-c, --config <path>', 'Configuration file path')
  .option('--author <author>', 'Filter by PR author')
  .option('--since <date>', 'Show PRs since date (YYYY-MM-DD)')
  .option('--file <path>', 'Show PRs affecting specific file')
  .action(() => {
    console.log('ylog show - implementation coming in milestone 5.2');
  });

program
  .command('clean')
  .description('Clean cache and generated files')
  .option('-c, --config <path>', 'Configuration file path')
  .option('--cache-only', 'Only clean cache files')
  .action(() => {
    console.log('ylog clean - implementation coming in milestone 6.2');
  });

// Parse command line arguments if run directly
if (require.main === module) {
  program.parse();
}

export { program };