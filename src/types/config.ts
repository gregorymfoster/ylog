/**
 * Configuration types for ylog2
 */

export interface Ylog2Config {
  dataDir: string
  storage: StorageConfig
  ai: AIConfig
  exploration: ExplorationConfig
  questions: QuestionConfig
  synthesis: SynthesisConfig
  session: SessionConfig
}

export interface StorageConfig {
  strategy: 'centralized' | 'inline'
  format: 'json' | 'markdown'
  compression: boolean
  backup: boolean
  maxHistoryDays: number
}

export interface AIConfig {
  provider: 'ollama' | 'anthropic'
  model: string
  endpoint?: string
  apiKey?: string
  maxTokens: number
  temperature: number
  timeout: number
}

export interface ExplorationConfig {
  maxDepth: number
  ignorePatterns: string[]
  focusAreas: string[]
  includeTests: boolean
  minFileSize: number
  maxFileSize: number
  supportedLanguages: string[]
}

export interface QuestionConfig {
  maxPerSession: number
  prioritize: QuestionPriority[]
  questionTypes: import('./core.js').QuestionType[]
  adaptiveDifficulty: boolean
  contextWindow: number
  followUpProbability: number
}

export type QuestionPriority = 'recent_changes' | 'complex_code' | 'missing_context' | 'high_impact' | 'user_focus'

export interface SynthesisConfig {
  updateInterval: 'after_each_question' | 'session_end' | 'real_time'
  contextFileThreshold: number
  confidenceThreshold: number
  autoGenerate: boolean
  includeMetrics: boolean
}

export interface SessionConfig {
  defaultLength: 'quick' | 'medium' | 'deep'
  autoSave: boolean
  resumeTimeout: number // minutes
  progressVisualization: boolean
  gamification: GamificationConfig
}

export interface GamificationConfig {
  enabled: boolean
  showProgress: boolean
  showStreak: boolean
  showImpact: boolean
  celebrations: boolean
}

export interface ResolvedYlog2Config extends Ylog2Config {
  // Computed/resolved values
  repoRoot: string
  gitRepo: string
  cacheDir: string
  outputDir: string
}

// Default configuration
export const DEFAULT_CONFIG: Omit<Ylog2Config, 'dataDir'> = {
  storage: {
    strategy: 'centralized',
    format: 'json',
    compression: false,
    backup: true,
    maxHistoryDays: 365
  },
  ai: {
    provider: 'ollama',
    model: 'deepseek-r1:32b',
    endpoint: 'http://localhost:11434',
    maxTokens: 4000,
    temperature: 0.3,
    timeout: 60000
  },
  exploration: {
    maxDepth: 10,
    ignorePatterns: [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      'coverage',
      '.nyc_output',
      'logs'
    ],
    focusAreas: ['src', 'lib', 'app', 'components'],
    includeTests: false,
    minFileSize: 100,
    maxFileSize: 50000,
    supportedLanguages: ['typescript', 'javascript', 'python', 'go', 'rust', 'java']
  },
  questions: {
    maxPerSession: 10,
    prioritize: ['recent_changes', 'missing_context', 'complex_code'],
    questionTypes: ['why', 'alternatives', 'tradeoffs', 'business'],
    adaptiveDifficulty: true,
    contextWindow: 1000,
    followUpProbability: 0.3
  },
  synthesis: {
    updateInterval: 'after_each_question',
    contextFileThreshold: 3,
    confidenceThreshold: 0.6,
    autoGenerate: true,
    includeMetrics: true
  },
  session: {
    defaultLength: 'medium',
    autoSave: true,
    resumeTimeout: 60,
    progressVisualization: true,
    gamification: {
      enabled: true,
      showProgress: true,
      showStreak: true,
      showImpact: true,
      celebrations: true
    }
  }
}

// Legacy ylog config types for migration
export type YlogConfig = {
  github?: {
    repo?: string;
    token?: string;
    throttleRpm?: number;
  };
  ai: {
    provider: 'ollama' | 'anthropic';
    model: string;
    apiKey?: string;
    endpoint?: string;
    maxTokens?: number;
  };
  concurrency?: number;
  outputDir?: string;
  generateContextFiles?: boolean;
  contextFileThreshold?: number;
  historyMonths?: number;
  cacheDir?: string;
  diffMaxBytes?: number;
};