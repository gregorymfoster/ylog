/**
 * Configuration types for ylog
 */

export type YlogConfig = {
  github?: {
    repo?: string; // Auto-detect from git remote if not provided
    throttleRpm?: number; // Default 100
  };
  ai: {
    provider: 'ollama' | 'anthropic';
    model: string;
    apiKey?: string; // For Anthropic
    endpoint?: string; // For Ollama, default 'http://localhost:11434'
    maxTokens?: number; // Default 100
  };
  concurrency?: number; // Default 10
  outputDir?: string; // Default './ylog' (contains prs.db + HISTORY.md)
  generateContextFiles?: boolean; // Default true - create .ylog files
  contextFileThreshold?: number; // Default 3 - min PRs to generate .ylog
  historyMonths?: number; // Default 6 - timeframe for contextual files
  cacheDir?: string; // Default '~/.ylog-cache'
  diffMaxBytes?: number; // Default 1MB
};

/**
 * Fully resolved configuration with all defaults applied
 */
export type ResolvedYlogConfig = Required<Omit<YlogConfig, 'github' | 'ai'>> & {
  github: Required<NonNullable<YlogConfig['github']>>;
  ai: Required<Pick<YlogConfig['ai'], 'provider' | 'model'>> & Partial<Pick<YlogConfig['ai'], 'apiKey' | 'endpoint' | 'maxTokens'>>;
};

/**
 * Configuration validation result
 */
export type ConfigValidationResult = 
  | { success: true; config: ResolvedYlogConfig }
  | { success: false; error: string };

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  github: {
    throttleRpm: 100,
  },
  ai: {
    endpoint: 'http://localhost:11434',
    maxTokens: 100,
  },
  concurrency: 10,
  outputDir: './ylog',
  generateContextFiles: true,
  contextFileThreshold: 3,
  historyMonths: 6,
  cacheDir: '~/.ylog-cache',
  diffMaxBytes: 1048576, // 1MB
} as const;