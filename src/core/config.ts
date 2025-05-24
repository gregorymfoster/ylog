/**
 * Configuration management with Zod validation and auto-detection
 */

import { z } from 'zod';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execAsync } from '../utils/exec.js';
import type { YlogConfig, ResolvedYlogConfig } from '../types/index.js';

const YlogConfigSchema = z.object({
  github: z
    .object({
      repo: z.string().optional(),
      token: z.string().optional(),
      throttleRpm: z.number().min(1).max(5000).optional(),
    })
    .optional(),
  ai: z.object({
    provider: z.enum(['ollama', 'anthropic']),
    model: z.string(),
    apiKey: z.string().optional(),
    endpoint: z.string().url().optional(),
    maxTokens: z.number().min(100).max(200000).optional(),
  }),
  concurrency: z.number().min(1).max(50).optional(),
  outputDir: z.string().optional(),
  generateContextFiles: z.boolean().optional(),
  contextFileThreshold: z.number().min(1).optional(),
  historyMonths: z.number().min(1).max(60).optional(),
  cacheDir: z.string().optional(),
  diffMaxBytes: z.number().min(1000).optional(),
});

/**
 * Get GitHub token using authentication hierarchy
 */
export const getGitHubToken = async (config?: YlogConfig): Promise<string> => {
  // 1. Environment variable (highest priority)
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }

  // 2. Config file token
  if (config?.github?.token) {
    return config.github.token;
  }

  // 3. Use gh CLI token
  try {
    const result = await execAsync('gh auth token');
    return result.stdout.trim();
  } catch {
    throw new Error('GitHub token not found. Please set GITHUB_TOKEN environment variable, configure token in ylog.config.js, or run "gh auth login"');
  }
};

/**
 * Auto-detect GitHub repository from git remote
 */
export const detectGitHubRepo = async (): Promise<string> => {
  try {
    const remoteUrl = execSync('git remote get-url origin', { 
      encoding: 'utf8', 
      stdio: 'pipe' 
    }).trim();
    
    // Parse GitHub URLs (SSH and HTTPS)
    const githubMatch = remoteUrl.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    if (!githubMatch) {
      throw new Error('Not a GitHub repository');
    }
    return githubMatch[1];
  } catch (error) {
    throw new Error(`Failed to detect GitHub repo: ${error}`);
  }
};

/**
 * Load and validate configuration
 */
export const loadConfig = async (configPath?: string): Promise<ResolvedYlogConfig> => {
  const searchPaths = configPath 
    ? [configPath]
    : ['ylog.config.js', 'ylog.config.json', '.ylogrc.json'];

  let userConfig: Partial<YlogConfig> = {};

  for (const path of searchPaths) {
    if (existsSync(path)) {
      try {
        if (path.endsWith('.js')) {
          // Dynamic import for ES modules
          const configModule = require(join(process.cwd(), path));
          userConfig = configModule.default || configModule;
        } else {
          userConfig = JSON.parse(readFileSync(path, 'utf8'));
        }
        break;
      } catch (error) {
        throw new Error(`Failed to load config from ${path}: ${error}`);
      }
    }
  }

  // Auto-detect GitHub repo if not provided
  if (!userConfig.github?.repo) {
    try {
      const detectedRepo = await detectGitHubRepo();
      userConfig.github = { ...userConfig.github, repo: detectedRepo };
    } catch {
      // GitHub repo detection failed, will be caught in validation
    }
  }

  // Get GitHub token using hierarchy
  const githubToken = await getGitHubToken(userConfig as YlogConfig);
  userConfig.github = { ...userConfig.github, token: githubToken };

  return validateConfig(userConfig);
};

/**
 * Validate configuration with Zod
 */
export const validateConfig = (config: unknown): ResolvedYlogConfig => {
  const validated = YlogConfigSchema.parse(config);

  // Apply defaults for resolved config
  return {
    github: {
      repo: validated.github?.repo || '',
      token: validated.github?.token || '',
      throttleRpm: validated.github?.throttleRpm || 100,
    },
    ai: {
      provider: validated.ai.provider,
      model: validated.ai.model,
      apiKey: validated.ai.apiKey,
      endpoint: validated.ai.endpoint,
      maxTokens: validated.ai.maxTokens,
    },
    concurrency: validated.concurrency || 10,
    outputDir: validated.outputDir || '.ylog',
    generateContextFiles: validated.generateContextFiles ?? true,
    contextFileThreshold: validated.contextFileThreshold || 50,
    historyMonths: validated.historyMonths || 6,
    cacheDir: validated.cacheDir || '.ylog/cache',
    diffMaxBytes: validated.diffMaxBytes || 1000000,
  };
};