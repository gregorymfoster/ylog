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

export interface KnowledgeCluster {
  id: string
  name: string
  description: string
  items: string[]
  patterns: string[]
  insights: string[]
  confidence: number
  createdAt: Date
  updatedAt: Date
  metadata: {
    size: number
    coherence: number
    coverage: string[]
  }
}

export interface KnowledgePattern {
  id: string
  name: string
  description: string
  pattern: string
  examples: string[]
  confidence: number
  frequency: number
  relatedItems: string[]
  createdAt: Date
  updatedAt: Date
}

export interface SynthesisContext {
  sessionId: string
  responses: Array<{
    questionId: string
    answerId: string
    question: string
    answer: string
    insights: string[]
    timestamp: Date
  }>
  codeContext: {
    files: string[]
    functions: string[]
    changes: string[]
  }
  existingKnowledge: KnowledgeInsight[]
}

export interface SynthesisResult {
  newInsights: KnowledgeInsight[]
  updatedInsights: KnowledgeInsight[]
  newDecisions: ArchitecturalDecision[]
  newContext: BusinessContext[]
  newPatterns: KnowledgePattern[]
  updatedClusters: KnowledgeCluster[]
  confidence: number
  processingTime: number
}

export interface KnowledgeStorage {
  save(knowledge: KnowledgeBase): Promise<void>
  load(): Promise<KnowledgeBase | null>
  search(query: KnowledgeSearch): Promise<KnowledgeSearchResult[]>
  addInsight(insight: KnowledgeInsight): Promise<void>
  addDecision(decision: ArchitecturalDecision): Promise<void>
  addContext(context: BusinessContext): Promise<void>
  getMetrics(): Promise<KnowledgeMetrics>
  cleanup(): Promise<void>
}