/**
 * Question and answer types for interactive knowledge mining
 */

export interface Question {
  id: string
  type: 'multiple-choice' | 'freeform' | 'hybrid'
  text: string
  context: string
  options?: QuestionOption[]
  target: import('./core.js').QuestionTarget
  metadata: QuestionMetadata
  followUpPrompt?: string
}

export interface QuestionOption {
  key: string
  text: string
  description?: string
}

export interface QuestionMetadata {
  generated: Date
  model: string
  confidence: number
  category: import('./core.js').QuestionType
  estimatedAnswerTime: number // seconds
}

export interface UserResponse {
  questionId: string
  selectedOption?: string
  freeformText?: string
  timestamp: Date
  sessionId: string
  responseTime: number // seconds
}

export interface ProcessedAnswer {
  questionId: string
  rawResponse: UserResponse
  cleanedText: string
  extractedInsights: string[]
  categories: string[]
  confidence: number
  followUpQuestions?: string[]
  businessValue?: string
  technicalContext?: string
}

export interface QuestionPrompt {
  systemPrompt: string
  contextPrompt: string
  questionTemplate: string
  optionsTemplate?: string
}

export interface QuestionGenerationContext {
  codeContext: string
  fileAnalysis: string
  gitHistory: string
  dependencies: string
  patterns: string
}