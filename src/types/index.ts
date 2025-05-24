/**
 * Central type exports for ylog2
 */

// Core types
export * from './core.js'
export * from './questions.js'
export * from './knowledge.js'
export * from './config.js'

// Agent interfaces
export interface ExplorerAgent {
  exploreCodebase(): Promise<import('./core.js').CodeArea[]>
  analyzeArea(area: import('./core.js').CodeArea): Promise<import('./core.js').AreaAnalysis>
  identifyQuestionableCode(analysis: import('./core.js').AreaAnalysis): Promise<import('./core.js').QuestionTarget[]>
  detectPatterns(files: string[]): Promise<import('./core.js').ArchitecturalPattern[]>
}

export interface QuestionAgent {
  generateQuestion(target: import('./core.js').QuestionTarget): Promise<import('./questions.js').Question>
  presentQuestion(question: import('./questions.js').Question): Promise<import('./questions.js').UserResponse>
  processResponse(response: import('./questions.js').UserResponse): Promise<import('./questions.js').ProcessedAnswer>
  determineNextQuestion(context: import('./core.js').SessionContext): Promise<import('./core.js').QuestionTarget | null>
}

export interface KnowledgeAgent {
  storeAnswer(answer: import('./questions.js').ProcessedAnswer): Promise<void>
  synthesizeKnowledge(area: string): Promise<import('./knowledge.js').SynthesizedKnowledge>
  updateContextFiles(): Promise<void>
  searchKnowledge(query: string): Promise<import('./knowledge.js').KnowledgeSearchResult[]>
}

// Session management
export interface SessionManager {
  createSession(config: import('./config.js').Ylog2Config): Promise<import('./core.js').SessionContext>
  saveSession(context: import('./core.js').SessionContext): Promise<void>
  loadSession(sessionId: string): Promise<import('./core.js').SessionContext | null>
  resumeSession(sessionId: string): Promise<import('./core.js').SessionContext>
}

// Legacy types for migration from ylog v1
export type {
  YlogConfig as LegacyYlogConfig,
} from './config.js'