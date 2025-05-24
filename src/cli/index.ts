/**
 * ylog CLI entry point with full commander.js setup
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { detectGitHubRepo, loadConfig } from '../core/config.js';
import { SyncOrchestrator } from '../core/sync.js';
import { YlogDatabase } from '../core/database.js';
import { generateContextFiles, generateContextFile, detectAreas, shouldGenerateFile } from '../core/contextFiles.js';

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
  .option('--force', 'Re-process existing PRs')
  .option('--since <date>', 'Sync PRs since date (YYYY-MM-DD)')
  .option('--pr <numbers...>', 'Sync specific PR numbers')
  .option('--skip-ai', 'Skip AI processing (faster, data only)')
  .action(async (options) => {
    try {
      // Dynamic imports to avoid ESM/CommonJS issues
      const { default: ora } = await import('ora');
      const { default: chalk } = await import('chalk');

      const spinner = ora('Loading configuration...').start();

      try {
        // Load configuration
        const config = await loadConfig(options.config);
        spinner.succeed('Configuration loaded');

        // Validate PR numbers if provided
        const prNumbers = options.pr ? options.pr.map((n: string) => Number(n)).filter((n: number) => !isNaN(n)) : undefined;
        
        if (options.pr && (!prNumbers || prNumbers.length === 0)) {
          spinner.fail('Invalid PR numbers provided');
          process.exit(1);
        }

        // Initialize orchestrator
        const orchestrator = new SyncOrchestrator(config);

        // Test connections first
        spinner.start('Testing connections...');
        const connections = await orchestrator.testConnections();
        
        if (!connections.github) {
          spinner.fail('GitHub CLI not authenticated. Run: gh auth login');
          process.exit(1);
        }
        
        if (!connections.ai.success) {
          spinner.fail(`AI connection failed: ${connections.ai.error}`);
          process.exit(1);
        }
        
        spinner.succeed('All connections verified');

        // Start sync
        const syncOptions = {
          since: options.since,
          dryRun: options.dryRun,
          force: options.force,
          prNumbers,
          skipAI: options.skipAi,
        };

        let currentSpinner = ora('Starting sync...').start();

        const result = await orchestrator.sync(syncOptions, (progress) => {
          const { phase, processedPRs, totalPRs, currentPR, errors } = progress;
          
          switch (phase) {
            case 'fetching':
              currentSpinner.text = `Fetching PRs... (${processedPRs}/${totalPRs})`;
              break;
            case 'processing':
              const prText = currentPR ? ` #${currentPR}` : '';
              currentSpinner.text = `Processing PRs${prText}... (${processedPRs}/${totalPRs})`;
              break;
            case 'storing':
              currentSpinner.text = `Storing results... (${processedPRs}/${totalPRs})`;
              break;
            case 'complete':
              currentSpinner.succeed('Sync completed');
              break;
          }
          
          // Show errors as warnings
          if (errors.length > 0) {
            const newErrors = errors.slice(-1); // Only show latest error
            for (const error of newErrors) {
              console.log(chalk.yellow(`⚠️  Warning: ${error.error}`));
            }
          }
        });

        // Show summary
        console.log('\n' + chalk.bold('Sync Summary:'));
        console.log(`📊 Total PRs: ${result.totalPRs}`);
        console.log(`✅ Processed: ${result.processedPRs}`);
        console.log(`➕ Created: ${result.created}`);
        console.log(`🔄 Updated: ${result.updated}`);
        console.log(`⏭️  Skipped: ${result.skipped}`);
        
        if (result.errors.length > 0) {
          console.log(`❌ Errors: ${result.errors.length}`);
          if (result.errors.length <= 3) {
            result.errors.forEach(error => {
              console.log(`   ${chalk.red(error.error)}`);
            });
          } else {
            console.log(`   ${chalk.red('Run with --verbose to see all errors')}`);
          }
        }

        if (options.dryRun) {
          console.log(chalk.blue('\n🔍 Dry run complete - no changes made'));
        }

        orchestrator.close();

      } catch (error) {
        spinner.fail(`Sync failed: ${error}`);
        process.exit(1);
      }
      
    } catch (error) {
      console.error('Failed to import dependencies:', error);
      process.exit(1);
    }
  });

program
  .command('show')
  .description('Query and display PR history')
  .option('-c, --config <path>', 'Configuration file path')
  .option('--author <author>', 'Filter by PR author')
  .option('--since <date>', 'Show PRs since date (YYYY-MM-DD)')
  .option('--file <path>', 'Show PRs affecting specific file')
  .option('--area <area>', 'Show PRs affecting specific area (e.g., src/auth)')
  .option('--limit <number>', 'Number of PRs to show', '10')
  .option('--format <format>', 'Output format (table|json|summary)', 'table')
  .action(async (options) => {
    try {
      const { default: chalk } = await import('chalk');

      // Load configuration
      const config = await loadConfig(options.config);
      
      // Initialize database
      const dbPath = join(config.outputDir, 'prs.db');
      if (!existsSync(dbPath)) {
        console.error(chalk.red('❌ No data found. Run "ylog sync" first.'));
        process.exit(1);
      }

      const db = new YlogDatabase(dbPath);

      try {
        // Build query filters
        const filters: any = {
          limit: parseInt(options.limit) || 10,
        };

        if (options.author) filters.author = options.author;
        if (options.since) filters.since = options.since;
        if (options.file) filters.file = options.file;

        // Query PRs
        let prs = db.getPRs(filters);

        // Apply area filtering if specified (post-query filtering)
        if (options.area) {
          const allPRsWithFiles = db.getPRsForContext();
          const areas = detectAreas(allPRsWithFiles);
          
          if (!areas.has(options.area)) {
            console.log(chalk.yellow(`No PRs found affecting area: ${options.area}`));
            const availableAreas = Array.from(areas.keys()).slice(0, 10);
            if (availableAreas.length > 0) {
              console.log(chalk.gray('Available areas:'), availableAreas.join(', '));
            }
            db.close();
            return;
          }

          const areaPRNumbers = new Set(areas.get(options.area)!.map(pr => pr.number));
          prs = prs.filter(pr => areaPRNumbers.has(pr.number));
        }

        if (prs.length === 0) {
          console.log(chalk.yellow('No PRs found matching the criteria.'));
          db.close();
          return;
        }

        // Display results based on format
        switch (options.format) {
          case 'json':
            console.log(JSON.stringify(prs, null, 2));
            break;

          case 'summary':
            console.log(chalk.bold(`Found ${prs.length} PRs:\n`));
            prs.forEach(pr => {
              console.log(chalk.blue(`#${pr.number}`), chalk.bold(pr.title));
              console.log(chalk.gray(`  👤 ${pr.author} • 📅 ${new Date(pr.created_at).toLocaleDateString()}`));
              if (pr.why) {
                console.log(chalk.green(`  💡 ${pr.why.substring(0, 100)}${pr.why.length > 100 ? '...' : ''}`));
              }
              console.log('');
            });
            break;

          case 'table':
          default:
            console.log(chalk.bold('PR History:'));
            console.log('');
            
            // Table header
            const header = `${chalk.bold('PR')}    ${chalk.bold('Title'.padEnd(40))} ${chalk.bold('Author'.padEnd(15))} ${chalk.bold('Date')}`;
            console.log(header);
            console.log('─'.repeat(80));

            // Table rows
            prs.forEach(pr => {
              const prNum = `#${pr.number}`.padEnd(6);
              const title = pr.title.length > 40 ? pr.title.substring(0, 37) + '...' : pr.title.padEnd(40);
              const author = pr.author.padEnd(15);
              const date = new Date(pr.created_at).toLocaleDateString();
              
              console.log(`${chalk.blue(prNum)} ${title} ${chalk.gray(author)} ${date}`);
              
              if (pr.why) {
                const why = pr.why.length > 70 ? pr.why.substring(0, 67) + '...' : pr.why;
                console.log(`      ${chalk.green(why)}`);
              }
              console.log('');
            });
            break;
        }

        // Show database stats
        if (options.format !== 'json') {
          const stats = db.getStats();
          console.log(chalk.gray(`\n📊 Database: ${stats.totalPRs} total PRs, ${stats.totalFiles} files tracked`));
        }

      } finally {
        db.close();
      }

    } catch (error) {
      console.error('Show command failed:', error);
      process.exit(1);
    }
  });

program
  .command('clean')
  .description('Clean cache and generated files')
  .option('-c, --config <path>', 'Configuration file path')
  .option('--cache-only', 'Only clean cache files')
  .option('--force', 'Skip confirmation prompt')
  .action(async (options) => {
    try {
      const { default: chalk } = await import('chalk');
      
      // Load configuration
      const config = await loadConfig(options.config);
      
      // Files/directories to clean
      const toClean = [];
      
      if (!options.cacheOnly) {
        // Add main output directory
        if (existsSync(config.outputDir)) {
          toClean.push({ path: config.outputDir, type: 'output' });
        }
      }
      
      // Add cache directory
      if (existsSync(config.cacheDir)) {
        toClean.push({ path: config.cacheDir, type: 'cache' });
      }

      if (toClean.length === 0) {
        console.log(chalk.yellow('Nothing to clean.'));
        return;
      }

      // Show what will be cleaned
      console.log(chalk.bold('Will clean:'));
      toClean.forEach(item => {
        console.log(`  ${item.type === 'cache' ? '🗄️ ' : '📁 '} ${item.path}`);
      });

      // Confirmation (unless --force)
      if (!options.force) {
        console.log(chalk.yellow('\nThis will permanently delete these files. Continue? (y/N)'));
        process.stdout.write('> ');
        
        // Simple readline for confirmation
        const answer = await new Promise<string>((resolve) => {
          process.stdin.once('data', (data) => {
            resolve(data.toString().trim().toLowerCase());
          });
        });

        if (answer !== 'y' && answer !== 'yes') {
          console.log('Cancelled.');
          return;
        }
      }

      // Clean the files
      for (const item of toClean) {
        try {
          const { rmSync } = await import('fs');
          rmSync(item.path, { recursive: true, force: true });
          console.log(chalk.green(`✅ Cleaned ${item.path}`));
        } catch (error) {
          console.log(chalk.red(`❌ Failed to clean ${item.path}: ${error}`));
        }
      }

      console.log(chalk.green('\n🧹 Cleanup complete'));

    } catch (error) {
      console.error('Clean command failed:', error);
      process.exit(1);
    }
  });

program
  .command('generate')
  .argument('[area]', 'Specific area to regenerate (e.g., src/auth)')
  .option('-c, --config <path>', 'Configuration file path')
  .description('Regenerate context files for specific areas')
  .action(async (area, options) => {
    try {
      const { default: chalk } = await import('chalk');
      const config = await loadConfig(options.config);
      const db = new YlogDatabase(join(config.outputDir, 'prs.db'));
      
      // Check if database has data
      const stats = db.getStats();
      if (stats.totalPRs === 0) {
        console.log(chalk.yellow('No PR data found. Run "ylog sync" first.'));
        process.exit(1);
      }

      if (area) {
        // Generate for specific area
        console.log(chalk.blue(`🔄 Regenerating context for: ${area}`));
        
        const allPRs = db.getPRsForContext();
        const areas = detectAreas(allPRs);
        
        if (!areas.has(area)) {
          console.log(chalk.yellow(`No PRs found affecting area: ${area}`));
          const availableAreas = Array.from(areas.keys()).slice(0, 10);
          if (availableAreas.length > 0) {
            console.log(chalk.gray('Available areas:'), availableAreas.join(', '));
          }
          process.exit(1);
        }

        const areaPRs = areas.get(area)!;
        if (!shouldGenerateFile(area, areaPRs.length, config)) {
          console.log(chalk.yellow(`Area "${area}" doesn't meet threshold (${areaPRs.length} PRs < ${config.contextFileThreshold})`));
          process.exit(1);
        }

        await generateContextFile(area, areaPRs, config);
        console.log(chalk.green(`✅ Generated: ${area}/.ylog`));
      } else {
        // Regenerate all context files
        console.log(chalk.blue('🔄 Regenerating all context files...'));
        
        const allPRs = db.getPRsForContext();
        const result = await generateContextFiles(allPRs, config);
        
        console.log(chalk.green(`✅ Generated ${result.generated} context files (skipped ${result.skipped})`));
      }

      db.close();
    } catch (error) {
      console.error('Generate command failed:', error);
      process.exit(1);
    }
  });

// Parse command line arguments if run directly
if (require.main === module) {
  program.parse();
}

export { program };