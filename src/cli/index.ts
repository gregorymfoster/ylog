/**
 * ylog2 CLI entry point - Interactive knowledge mining tool
 */

import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ConfigManager } from '../core/config.js';
import { CodeExplorer } from '../core/explorer.js';
import { SessionManager } from '../core/session.js';

// Get package.json for version
const packagePath = join(__dirname, '../../package.json');

let version = '0.0.0';
try {
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
  version = packageJson.version;
} catch {
  version = '2.0.0-dev'; // Fallback for ylog2
}

const program = new Command();

program
  .name('ylog2')
  .description('Interactive knowledge mining for codebases - Transform your code into institutional memory through intelligent Q&A')
  .version(version);

// Init command - create ylog2 configuration
program
  .command('init')
  .description('Initialize ylog2 interactive knowledge mining')
  .option('-f, --force', 'Overwrite existing configuration')
  .option('--provider <provider>', 'AI provider (ollama|anthropic)', 'ollama')
  .option('--model <model>', 'AI model name', 'llama3.2')
  .option('--datadir <dir>', 'Data directory name', '.ylog2')
  .action(async (options) => {
    try {
      const { default: chalk } = await import('chalk');
      
      const configPath = 'ylog2.config.json';
      
      if (existsSync(configPath) && !options.force) {
        console.error(chalk.red('❌ Configuration already exists. Use --force to overwrite.'));
        process.exit(1);
      }

      console.log(chalk.blue('🚀 Initializing ylog2 - Interactive Knowledge Mining'));
      console.log();

      // Create configuration
      const configOptions = {
        dataDir: options.datadir,
        ai: {
          provider: options.provider,
          model: options.model,
          ...(options.provider === 'anthropic' && {
            apiKey: process.env.ANTHROPIC_API_KEY || 'YOUR_ANTHROPIC_API_KEY'
          }),
          ...(options.provider === 'ollama' && {
            endpoint: 'http://localhost:11434'
          })
        }
      };

      const createdConfigPath = await ConfigManager.createConfig(configOptions);
      console.log(chalk.green(`✅ Configuration created: ${createdConfigPath}`));
      
      if (options.provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
        console.log(chalk.yellow('\n⚠️  Remember to set your Anthropic API key:'));
        console.log('   • Set ANTHROPIC_API_KEY environment variable, or');
        console.log('   • Update the apiKey in ylog2.config.json');
      }
      
      console.log(chalk.cyan('\n🎯 Next steps:'));
      console.log('1. Review ylog2.config.json and adjust settings as needed');
      console.log('2. Run "ylog2" to start your first interactive session');
      console.log('3. Answer questions about your codebase to build knowledge');
      
    } catch (error) {
      console.error('❌ Failed to initialize:', error);
      process.exit(1);
    }
  });

// Main interactive session command (default when no command specified)
program
  .command('session', { isDefault: true })
  .description('Start an interactive knowledge mining session')
  .option('-c, --config <path>', 'Configuration file path')
  .option('--quick', 'Quick session (5-10 minutes)')
  .option('--deep', 'Deep dive session (30+ minutes)')
  .option('--area <area>', 'Focus on specific area (e.g., src/auth)')
  .action(async (options) => {
    try {
      const { default: chalk } = await import('chalk');
      const { default: ora } = await import('ora');

      // Load configuration
      const config = await ConfigManager.loadConfig(options.config);
      
      console.log(chalk.blue('🔍 ylog2 - Interactive Knowledge Mining'));
      console.log(chalk.gray(`Repository: ${config.gitRepo}`));
      console.log();

      // Initialize explorer
      const explorer = new CodeExplorer(config);
      
      // Start exploration
      const spinner = ora('Exploring codebase...').start();
      
      try {
        const areas = await explorer.exploreCodebase();
        spinner.succeed(`Found ${areas.length} areas to explore`);
        
        if (areas.length === 0) {
          console.log(chalk.yellow('❓ No areas found to explore. Try adjusting your configuration.'));
          return;
        }

        // Display summary
        console.log(chalk.bold('\n📊 Exploration Summary:'));
        console.log(`📁 Areas discovered: ${areas.length}`);
        const highComplexity = areas.filter(a => a.complexity > 30).length;
        const recentlyChanged = areas.filter(a => a.changeFrequency > 0).length;
        console.log(`🔥 High complexity areas: ${highComplexity}`);
        console.log(`📈 Recently changed areas: ${recentlyChanged}`);
        
        // Start interactive session
        const sessionManager = new SessionManager(config);
        await sessionManager.runInteractiveSession();
        
      } catch (error) {
        spinner.fail(`Exploration failed: ${error}`);
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Session failed:', error);
      process.exit(1);
    }
  });

// Explore command - non-interactive exploration
program
  .command('explore')
  .description('Explore codebase and show analysis (non-interactive)')
  .option('-c, --config <path>', 'Configuration file path')
  .option('--format <format>', 'Output format (table|json)', 'table')
  .action(async (options) => {
    try {
      const { default: chalk } = await import('chalk');
      const { default: ora } = await import('ora');

      const config = await ConfigManager.loadConfig(options.config);
      const explorer = new CodeExplorer(config);
      
      const spinner = ora('Analyzing codebase...').start();
      
      const areas = await explorer.exploreCodebase();
      spinner.succeed(`Analyzed ${areas.length} areas`);
      
      if (options.format === 'json') {
        console.log(JSON.stringify(areas, null, 2));
      } else {
        // Table format
        console.log(chalk.bold('\n📊 Codebase Analysis:'));
        console.log();
        
        const header = `${'Path'.padEnd(40)} ${'Type'.padEnd(10)} ${'Complexity'.padEnd(12)} ${'Changes'.padEnd(10)} ${'Contributors'}`;
        console.log(chalk.bold(header));
        console.log('─'.repeat(85));
        
        areas.slice(0, 20).forEach(area => {
          const path = area.path.length > 38 ? '...' + area.path.slice(-35) : area.path.padEnd(40);
          const type = area.type.padEnd(10);
          const complexity = area.complexity.toFixed(1).padEnd(12);
          const changes = area.changeFrequency.toString().padEnd(10);
          const contributors = area.contributors.length.toString();
          
          console.log(`${path} ${type} ${complexity} ${changes} ${contributors}`);
        });
        
        if (areas.length > 20) {
          console.log(chalk.gray(`\n... and ${areas.length - 20} more areas`));
        }
      }
      
    } catch (error) {
      console.error('❌ Exploration failed:', error);
      process.exit(1);
    }
  });

// Resume command - resume a previous session
program
  .command('resume')
  .description('Resume a previous knowledge mining session')
  .argument('[sessionId]', 'Session ID to resume')
  .option('-c, --config <path>', 'Configuration file path')
  .action(async (sessionId, options) => {
    try {
      const { default: chalk } = await import('chalk');
      
      const config = await ConfigManager.loadConfig(options.config);
      const sessionManager = new SessionManager(config);
      
      if (sessionId) {
        await sessionManager.resumeSession(sessionId);
      } else {
        console.log(chalk.yellow('❓ No session ID provided'));
        console.log('Usage: ylog2 resume <sessionId>');
        console.log('       ylog2 resume sess_abc123');
      }
      
    } catch (error) {
      console.error('❌ Resume failed:', error);
      process.exit(1);
    }
  });

// Status command - show current knowledge state
program
  .command('status')
  .description('Show current knowledge mining status')
  .option('-c, --config <path>', 'Configuration file path')
  .action(async (options) => {
    try {
      const { default: chalk } = await import('chalk');
      
      const config = await ConfigManager.loadConfig(options.config);
      const sessionManager = new SessionManager(config);
      
      console.log(chalk.blue('📊 ylog2 Knowledge Mining Status'));
      console.log(chalk.gray(`Repository: ${config.gitRepo}`));
      console.log();
      
      // Get session statistics
      const stats = sessionManager.getSessionStats();
      
      console.log(chalk.bold('📈 Session Statistics:'));
      console.log(`Total sessions: ${stats.totalSessions}`);
      console.log(`Total questions answered: ${stats.totalQuestions}`);
      console.log(`Average session length: ${stats.averageSessionLength} minutes`);
      console.log();
      
      console.log(chalk.bold('🎯 Quick Actions:'));
      console.log('• Run "ylog2" to start a new session');
      console.log('• Run "ylog2 explore" to analyze your codebase');
      console.log('• Run "ylog2 resume <sessionId>" to continue a session');
      
    } catch (error) {
      console.error('❌ Status failed:', error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

export { program };
