import { generateObject, generateText } from 'ai'
import {
  KnowledgeSearch,
  KnowledgeSearchResult,
  KnowledgeBase,
  KnowledgeInsight,
  ArchitecturalDecision,
  BusinessContext,
  KnowledgePattern,
  KnowledgeCluster
} from '../types/knowledge.js'
import { AIProvider } from './ai.js'
import { SQLiteKnowledgeStorage } from './knowledge-storage.js'
import { z } from 'zod'

interface SearchIndex {
  insights: Map<string, KnowledgeInsight>
  decisions: Map<string, ArchitecturalDecision>
  contexts: Map<string, BusinessContext>
  patterns: Map<string, KnowledgePattern>
  clusters: Map<string, KnowledgeCluster>
}

interface SemanticSearchResult {
  item: any
  type: 'insight' | 'decision' | 'context' | 'pattern' | 'cluster'
  score: number
  explanation: string
}

export class KnowledgeSearchEngine {
  private index: SearchIndex = {
    insights: new Map(),
    decisions: new Map(),
    contexts: new Map(),
    patterns: new Map(),
    clusters: new Map()
  }

  constructor(
    private storage: SQLiteKnowledgeStorage,
    private aiProvider: AIProvider
  ) {}

  async initialize(): Promise<void> {
    await this.storage.initialize()
    await this.buildIndex()
  }

  private async buildIndex(): Promise<void> {
    const knowledge = await this.storage.load()
    if (!knowledge) return

    this.index.insights.clear()
    this.index.decisions.clear()
    this.index.contexts.clear()

    for (const insight of knowledge.insights) {
      this.index.insights.set(insight.id, insight)
    }

    for (const decision of knowledge.decisions) {
      this.index.decisions.set(decision.id, decision)
    }

    for (const context of knowledge.businessContext) {
      this.index.contexts.set(context.id, context)
    }
  }

  async search(query: string, options: {
    type?: ('insight' | 'decision' | 'context' | 'pattern' | 'cluster')[]
    area?: string
    limit?: number
    semantic?: boolean
  } = {}): Promise<KnowledgeSearchResult[]> {
    const {
      type = ['insight', 'decision', 'context'],
      area,
      limit = 20,
      semantic = true
    } = options

    if (semantic) {
      return this.semanticSearch(query, { type, area, limit })
    } else {
      return this.keywordSearch(query, { type, area, limit })
    }
  }

  private async semanticSearch(
    query: string,
    options: { type: string[], area?: string, limit: number }
  ): Promise<KnowledgeSearchResult[]> {
    const allItems: Array<{ item: any, type: string }> = []

    if (options.type.includes('insight')) {
      for (const insight of this.index.insights.values()) {
        if (!options.area || insight.area === options.area) {
          allItems.push({ item: insight, type: 'insight' })
        }
      }
    }

    if (options.type.includes('decision')) {
      for (const decision of this.index.decisions.values()) {
        if (!options.area || decision.area === options.area) {
          allItems.push({ item: decision, type: 'decision' })
        }
      }
    }

    if (options.type.includes('context')) {
      for (const context of this.index.contexts.values()) {
        if (!options.area || context.area === options.area) {
          allItems.push({ item: context, type: 'context' })
        }
      }
    }

    if (allItems.length === 0) {
      return []
    }

    try {
      const semanticResults = await this.performSemanticRanking(query, allItems)
      
      return semanticResults
        .slice(0, options.limit)
        .map(result => ({
          type: result.type as any,
          relevance: result.score,
          content: this.extractContent(result.item, result.type),
          area: result.item.area || 'general',
          source: result.item.id,
          snippet: this.extractSnippet(result.item, result.type, query)
        }))
    } catch (error) {
      console.error('Semantic search failed, falling back to keyword search:', error)
      return this.keywordSearch(query, options)
    }
  }

  private async performSemanticRanking(
    query: string,
    items: Array<{ item: any, type: string }>
  ): Promise<SemanticSearchResult[]> {
    const prompt = `
You are an intelligent knowledge retrieval system with deep reasoning capabilities. Analyze the query and rank the knowledge items by their semantic relevance and conceptual similarity.

Query: "${query}"

Knowledge Items:
${items.map((item, i) => `
${i + 1}. [${item.type.toUpperCase()}] ${this.extractContent(item.item, item.type)}
   Area: ${item.item.area}
   Confidence: ${item.item.confidence || 'N/A'}
`).join('\n')}

Reason through each item step-by-step:
1. Understand the intent and context behind the query
2. Analyze how each knowledge item relates to that intent
3. Consider both direct matches and conceptual connections
4. Account for the type of knowledge (insight vs decision vs context)
5. Weight higher-confidence items appropriately

For each item, provide:
1. A relevance score (0.0 to 1.0) based on semantic similarity and usefulness
2. A brief explanation of your reasoning for the relevance score

Focus on semantic similarity to the query intent and conceptual relevance, not just keyword matching.
`

    try {
      const result = await generateObject({
        model: this.aiProvider.getModel(),
        schema: z.object({
          rankings: z.array(z.object({
            index: z.number(),
            score: z.number().min(0).max(1),
            explanation: z.string()
          }))
        }),
        prompt
      })

      return result.object.rankings
        .map(ranking => ({
          item: items[ranking.index - 1]?.item,
          type: items[ranking.index - 1]?.type as any,
          score: ranking.score,
          explanation: ranking.explanation
        }))
        .filter(result => result.item && result.score > 0.1)
        .sort((a, b) => b.score - a.score)
    } catch (error) {
      console.error('AI ranking failed:', error)
      return []
    }
  }

  private async keywordSearch(
    query: string,
    options: { type: string[], area?: string, limit: number }
  ): Promise<KnowledgeSearchResult[]> {
    const searchQuery: KnowledgeSearch = {
      query,
      results: [],
      totalResults: 0
    }

    return this.storage.search(searchQuery)
  }

  async findSimilar(
    itemId: string,
    itemType: 'insight' | 'decision' | 'context',
    limit: number = 5
  ): Promise<KnowledgeSearchResult[]> {
    let item: any
    let content: string

    switch (itemType) {
      case 'insight':
        item = this.index.insights.get(itemId)
        content = item ? `${item.topic}: ${item.insight}` : ''
        break
      case 'decision':
        item = this.index.decisions.get(itemId)
        content = item ? `${item.decision}: ${item.rationale}` : ''
        break
      case 'context':
        item = this.index.contexts.get(itemId)
        content = item ? `${item.requirement}: ${item.implementation}` : ''
        break
      default:
        return []
    }

    if (!item || !content) {
      return []
    }

    return this.search(content, {
      type: ['insight', 'decision', 'context'],
      area: item.area,
      limit: limit + 1,
      semantic: true
    }).then(results => 
      results.filter(result => result.source !== itemId).slice(0, limit)
    )
  }

  async getRecommendations(
    area?: string,
    recentQuestions?: string[]
  ): Promise<{
    insights: KnowledgeInsight[]
    decisions: ArchitecturalDecision[]
    patterns: KnowledgePattern[]
    suggestions: string[]
  }> {
    const topInsights = Array.from(this.index.insights.values())
      .filter(insight => !area || insight.area === area)
      .sort((a, b) => (b.confidence * (b.impact === 'high' ? 1.5 : b.impact === 'medium' ? 1.2 : 1)) - 
                      (a.confidence * (a.impact === 'high' ? 1.5 : a.impact === 'medium' ? 1.2 : 1)))
      .slice(0, 5)

    const topDecisions = Array.from(this.index.decisions.values())
      .filter(decision => !area || decision.area === area)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)

    const topPatterns = Array.from(this.index.patterns.values())
      .sort((a, b) => (b.confidence * b.frequency) - (a.confidence * a.frequency))
      .slice(0, 3)

    const suggestions = await this.generateQuestionSuggestions(area, recentQuestions)

    return {
      insights: topInsights,
      decisions: topDecisions,
      patterns: topPatterns,
      suggestions
    }
  }

  private async generateQuestionSuggestions(
    area?: string,
    recentQuestions: string[] = []
  ): Promise<string[]> {
    const areaInsights = Array.from(this.index.insights.values())
      .filter(insight => !area || insight.area === area)
      .slice(0, 10)

    const areaDecisions = Array.from(this.index.decisions.values())
      .filter(decision => !area || decision.area === area)
      .slice(0, 5)

    if (areaInsights.length === 0 && areaDecisions.length === 0) {
      return [
        "What architectural patterns are used in this codebase?",
        "What were the key design decisions made?",
        "What business requirements drive the technical implementation?"
      ]
    }

    const prompt = `
Based on the existing knowledge about this codebase, suggest thoughtful questions that would help explore areas that haven't been covered yet.

Existing insights:
${areaInsights.map(i => `- ${i.topic}: ${i.insight}`).join('\n')}

Existing decisions:
${areaDecisions.map(d => `- ${d.decision}: ${d.rationale}`).join('\n')}

Recent questions asked:
${recentQuestions.map(q => `- ${q}`).join('\n')}

Generate 5 specific questions that would:
1. Fill knowledge gaps
2. Explore related areas
3. Dig deeper into existing topics
4. Uncover implicit knowledge
5. Help understand the "why" behind decisions

Focus on questions that would be valuable for developers working on this codebase.
`

    try {
      const result = await generateText({
        model: this.aiProvider.getModel(),
        prompt
      })

      const questions = result.text
        .split('\n')
        .filter(line => line.trim().match(/^\d+\./))
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(q => q.length > 10)

      return questions.slice(0, 5)
    } catch (error) {
      console.error('Failed to generate question suggestions:', error)
      return []
    }
  }

  private extractContent(item: any, type: string): string {
    switch (type) {
      case 'insight':
        return `${item.topic}: ${item.insight}`
      case 'decision':
        return `${item.decision}: ${item.rationale}`
      case 'context':
        return `${item.requirement}: ${item.implementation}`
      case 'pattern':
        return `${item.name}: ${item.description}`
      default:
        return item.toString()
    }
  }

  private extractSnippet(item: any, type: string, query: string): string {
    const content = this.extractContent(item, type)
    const queryWords = query.toLowerCase().split(/\s+/)
    
    const sentences = content.split(/[.!?]+/)
    const relevantSentence = sentences.find(sentence => 
      queryWords.some(word => sentence.toLowerCase().includes(word))
    )

    const snippet = relevantSentence || sentences[0] || content
    return snippet.length > 200 ? snippet.substring(0, 197) + '...' : snippet
  }

  async refresh(): Promise<void> {
    await this.buildIndex()
  }

  getStats(): {
    totalInsights: number
    totalDecisions: number
    totalContexts: number
    totalPatterns: number
    totalClusters: number
  } {
    return {
      totalInsights: this.index.insights.size,
      totalDecisions: this.index.decisions.size,
      totalContexts: this.index.contexts.size,
      totalPatterns: this.index.patterns.size,
      totalClusters: this.index.clusters.size
    }
  }
}