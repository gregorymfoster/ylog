/**
 * Knowledge representation and synthesis types
 */

export interface KnowledgeBase {
  areas: Map<string, AreaKnowledge>
  insights: KnowledgeInsight[]
  decisions: ArchitecturalDecision[]
  businessContext: BusinessContext[]
  lastUpdated: Date
  version: string
}

export interface AreaKnowledge {
  area: string
  coverage: number
  lastUpdated: Date
  insights: KnowledgeInsight[]
  decisions: ArchitecturalDecision[]
  businessContext: BusinessContext[]
  qaHistory: QuestionAnswerPair[]
  synthesisConfidence: number
}

export interface KnowledgeInsight {
  id: string
  topic: string
  insight: string
  confidence: number
  sources: string[] // question IDs
  area: string
  category: 'technical' | 'business' | 'architectural' | 'process'
  impact: 'low' | 'medium' | 'high'
  created: Date
}

export interface ArchitecturalDecision {
  id: string
  decision: string
  rationale: string
  alternatives: string[]
  tradeoffs: string
  context: string
  area: string
  confidence: number
  sources: string[]
  created: Date
}

export interface BusinessContext {
  id: string
  requirement: string
  implementation: string
  impact: string
  stakeholder?: string
  priority: 'low' | 'medium' | 'high'
  area: string
  sources: string[]
  created: Date
}

export interface QuestionAnswerPair {
  questionId: string
  question: string
  answer: string
  category: import('./core.js').QuestionType
  timestamp: Date
  confidence: number
}

export interface SynthesizedKnowledge {
  area: string
  insights: KnowledgeInsight[]
  architecturalDecisions: ArchitecturalDecision[]
  businessContext: BusinessContext[]
  lastUpdated: Date
  coverage: number
  nextRecommendations: string[]
}

export interface KnowledgeSearch {
  query: string
  results: KnowledgeSearchResult[]
  totalResults: number
}

export interface KnowledgeSearchResult {
  type: 'insight' | 'decision' | 'context' | 'qa'
  relevance: number
  content: string
  area: string
  source: string
  snippet: string
}

export interface KnowledgeMetrics {
  totalQuestions: number
  totalInsights: number
  totalDecisions: number
  averageConfidence: number
  coverageByArea: Map<string, number>
  activityByDay: Map<string, number>
  topContributors: string[]
}