/**
 * Configuration management for ylog2
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { homedir } from 'os'
import { execSync } from 'child_process'
import { z } from 'zod'
import { Ylog2Config, ResolvedYlog2Config, DEFAULT_CONFIG } from '../types/config.js'

// Zod schemas for validation
const StorageConfigSchema = z.object({
  strategy: z.enum(['centralized', 'inline']),
  format: z.enum(['json', 'markdown']),
  compression: z.boolean(),
  backup: z.boolean(),
  maxHistoryDays: z.number().min(1)
})

const AIConfigSchema = z.object({
  provider: z.enum(['ollama', 'anthropic']),
  model: z.string().min(1),
  endpoint: z.string().optional(),
  apiKey: z.string().optional(),
  maxTokens: z.number().min(1),
  temperature: z.number().min(0).max(2),
  timeout: z.number().min(1000)
})

const ExplorationConfigSchema = z.object({
  maxDepth: z.number().min(1),
  ignorePatterns: z.array(z.string()),
  focusAreas: z.array(z.string()),
  includeTests: z.boolean(),
  minFileSize: z.number().min(0),
  maxFileSize: z.number().min(1),
  supportedLanguages: z.array(z.string())
})

const QuestionConfigSchema = z.object({
  maxPerSession: z.number().min(1),
  prioritize: z.array(z.enum(['recent_changes', 'complex_code', 'missing_context', 'high_impact', 'user_focus'])),
  questionTypes: z.array(z.enum(['why', 'alternatives', 'tradeoffs', 'business', 'performance', 'security'])),
  adaptiveDifficulty: z.boolean(),
  contextWindow: z.number().min(100),
  followUpProbability: z.number().min(0).max(1)
})

const SynthesisConfigSchema = z.object({
  updateInterval: z.enum(['after_each_question', 'session_end', 'real_time']),
  contextFileThreshold: z.number().min(1),
  confidenceThreshold: z.number().min(0).max(1),
  autoGenerate: z.boolean(),
  includeMetrics: z.boolean()
})

const GamificationConfigSchema = z.object({
  enabled: z.boolean(),
  showProgress: z.boolean(),
  showStreak: z.boolean(),
  showImpact: z.boolean(),
  celebrations: z.boolean()
})

const SessionConfigSchema = z.object({
  defaultLength: z.enum(['quick', 'medium', 'deep']),
  autoSave: z.boolean(),
  resumeTimeout: z.number().min(1),
  progressVisualization: z.boolean(),
  gamification: GamificationConfigSchema
})

const Ylog2ConfigSchema = z.object({
  dataDir: z.string().min(1),
  storage: StorageConfigSchema,
  ai: AIConfigSchema,
  exploration: ExplorationConfigSchema,
  questions: QuestionConfigSchema,
  synthesis: SynthesisConfigSchema,
  session: SessionConfigSchema
})

export class ConfigManager {
  private static readonly CONFIG_FILENAME = 'ylog2.config.json'
  private static readonly LEGACY_CONFIG_FILENAME = 'ylog.config.json'

  /**
   * Load configuration from file with validation and defaults
   */
  static async loadConfig(configPath?: string): Promise<ResolvedYlog2Config> {
    const resolvedPath = configPath || this.findConfigFile()
    
    let rawConfig: any = {}
    
    if (resolvedPath && existsSync(resolvedPath)) {
      try {
        const content = readFileSync(resolvedPath, 'utf-8')
        rawConfig = JSON.parse(content)
      } catch (error) {
        throw new Error(`Failed to parse config file ${resolvedPath}: ${error}`)
      }
    }

    // Apply defaults and validate
    const config = this.applyDefaults(rawConfig)
    const validated = this.validateConfig(config)
    
    // Resolve computed values
    return this.resolveConfig(validated)
  }

  /**
   * Find configuration file (prefer ylog2, fallback to ylog)
   */
  private static findConfigFile(): string | null {
    const cwd = process.cwd()
    
    // Check for ylog2 config first
    const ylog2Config = join(cwd, this.CONFIG_FILENAME)
    if (existsSync(ylog2Config)) {
      return ylog2Config
    }
    
    // Check for legacy ylog config
    const legacyConfig = join(cwd, this.LEGACY_CONFIG_FILENAME)
    if (existsSync(legacyConfig)) {
      console.log('⚠️  Found legacy ylog.config.json - consider migrating to ylog2.config.json')
      return legacyConfig
    }
    
    return null
  }

  /**
   * Apply default values to configuration
   */
  private static applyDefaults(rawConfig: any): Ylog2Config {
    const dataDir = rawConfig.dataDir || '.ylog2'
    
    return {
      dataDir,
      storage: { ...DEFAULT_CONFIG.storage, ...rawConfig.storage },
      ai: { ...DEFAULT_CONFIG.ai, ...rawConfig.ai },
      exploration: { 
        ...DEFAULT_CONFIG.exploration, 
        ...rawConfig.exploration,
        ignorePatterns: [
          ...DEFAULT_CONFIG.exploration.ignorePatterns,
          ...(rawConfig.exploration?.ignorePatterns || [])
        ]
      },
      questions: { ...DEFAULT_CONFIG.questions, ...rawConfig.questions },
      synthesis: { ...DEFAULT_CONFIG.synthesis, ...rawConfig.synthesis },
      session: {
        ...DEFAULT_CONFIG.session,
        ...rawConfig.session,
        gamification: {
          ...DEFAULT_CONFIG.session.gamification,
          ...rawConfig.session?.gamification
        }
      }
    }
  }

  /**
   * Validate configuration using Zod schemas
   */
  private static validateConfig(config: any): Ylog2Config {
    try {
      return Ylog2ConfigSchema.parse(config)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(issue => 
          `${issue.path.join('.')}: ${issue.message}`
        ).join('\n')
        throw new Error(`Configuration validation failed:\n${issues}`)
      }
      throw error
    }
  }

  /**
   * Resolve computed configuration values
   */
  private static resolveConfig(config: Ylog2Config): ResolvedYlog2Config {
    const repoRoot = this.findGitRoot()
    const gitRepo = this.detectGitRepo()
    
    return {
      ...config,
      repoRoot,
      gitRepo,
      cacheDir: resolve(config.dataDir, 'cache'),
      outputDir: resolve(config.dataDir)
    }
  }

  /**
   * Find git repository root
   */
  private static findGitRoot(): string {
    try {
      return execSync('git rev-parse --show-toplevel', { 
        encoding: 'utf-8',
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim()
    } catch {
      return process.cwd()
    }
  }

  /**
   * Detect git repository from remote URL
   */
  private static detectGitRepo(): string {
    try {
      const remoteUrl = execSync('git remote get-url origin', {
        encoding: 'utf-8',
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim()

      // Parse GitHub URL
      const githubMatch = remoteUrl.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/)
      if (githubMatch) {
        return `${githubMatch[1]}/${githubMatch[2]}`
      }

      return 'unknown/repository'
    } catch {
      return 'unknown/repository'
    }
  }

  /**
   * Create a new configuration file
   */
  static async createConfig(options: Partial<Ylog2Config> = {}): Promise<string> {
    const config: Ylog2Config = {
      dataDir: options.dataDir || '.ylog2',
      storage: { ...DEFAULT_CONFIG.storage, ...options.storage },
      ai: { ...DEFAULT_CONFIG.ai, ...options.ai },
      exploration: { ...DEFAULT_CONFIG.exploration, ...options.exploration },
      questions: { ...DEFAULT_CONFIG.questions, ...options.questions },
      synthesis: { ...DEFAULT_CONFIG.synthesis, ...options.synthesis },
      session: { ...DEFAULT_CONFIG.session, ...options.session }
    }

    const configPath = join(process.cwd(), this.CONFIG_FILENAME)
    
    writeFileSync(configPath, JSON.stringify(config, null, 2))
    
    return configPath
  }

  /**
   * Get default configuration for initial setup
   */
  static getDefaultConfig(): Ylog2Config {
    return {
      dataDir: '.ylog2',
      ...DEFAULT_CONFIG
    }
  }
}