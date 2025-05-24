/**
 * Core data structures for ylog2 interactive knowledge mining
 */

export interface CodeArea {
  path: string
  type: 'directory' | 'file'
  complexity: number
  changeFrequency: number
  lastModified: Date
  dependencies: string[]
  contributors: string[]
  linesOfCode?: number
  language?: string
}

export interface AreaAnalysis {
  area: CodeArea
  patterns: ArchitecturalPattern[]
  hotSpots: CodeHotSpot[]
  contextGaps: ContextGap[]
  recentChanges: RecentChange[]
  dependencies: DependencyInfo[]
}

export interface ArchitecturalPattern {
  type: 'mvc' | 'component' | 'service' | 'utility' | 'config' | 'test'
  confidence: number
  files: string[]
  description: string
}

export interface CodeHotSpot {
  file: string
  reason: 'high_complexity' | 'frequent_changes' | 'many_contributors' | 'large_size'
  score: number
  details: string
}

export interface ContextGap {
  file: string
  lines?: [number, number]
  reason: 'no_comments' | 'complex_logic' | 'unclear_naming' | 'missing_docs'
  severity: 'low' | 'medium' | 'high'
}

export interface RecentChange {
  file: string
  author: string
  date: Date
  summary: string
  linesChanged: number
}

export interface DependencyInfo {
  name: string
  type: 'internal' | 'external'
  usageCount: number
  files: string[]
}

export interface QuestionTarget {
  area: CodeArea
  focus: 'architecture' | 'business' | 'tradeoffs' | 'dependencies' | 'performance' | 'security'
  context: QuestionContext
  priority: number
  estimatedTime: number // minutes
}

export interface QuestionContext {
  gitBlame: GitBlameData
  fileContent: string
  dependencies: string[]
  recentChanges: RecentChange[]
  relatedFiles: string[]
}

export interface GitBlameData {
  file: string
  lines: GitBlameLine[]
}

export interface GitBlameLine {
  lineNumber: number
  author: string
  date: Date
  commit: string
  content: string
}

export interface SessionContext {
  sessionId: string
  startTime: Date
  questionsAnswered: number
  areasExplored: string[]
  currentArea?: CodeArea
  userPreferences: UserPreferences
  knowledgeProgress: KnowledgeProgress
}

export interface UserPreferences {
  sessionLength: 'quick' | 'medium' | 'deep'
  questionTypes: QuestionType[]
  focusAreas: string[]
  skipPatterns: string[]
}

export type QuestionType = 'why' | 'alternatives' | 'tradeoffs' | 'business' | 'performance' | 'security'

export interface KnowledgeProgress {
  totalAreas: number
  areasWithContext: number
  questionsAnswered: number
  insightsGenerated: number
  coveragePercentage: number
}