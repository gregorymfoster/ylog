import { generateObject, generateText } from 'ai'
import {
  SynthesisContext,
  SynthesisResult,
  KnowledgeInsight,
  ArchitecturalDecision,
  BusinessContext,
  KnowledgePattern,
  KnowledgeCluster
} from '../types/knowledge.js'
import { AIProvider } from './ai.js'
import { z } from 'zod'

const InsightSchema = z.object({
  topic: z.string(),
  insight: z.string(),
  confidence: z.number().min(0).max(1),
  category: z.enum(['technical', 'business', 'architectural', 'process']),
  impact: z.enum(['low', 'medium', 'high']),
  relatedFiles: z.array(z.string()).optional()
})

const DecisionSchema = z.object({
  decision: z.string(),
  rationale: z.string(),
  alternatives: z.array(z.string()),
  tradeoffs: z.string(),
  context: z.string(),
  confidence: z.number().min(0).max(1)
})

const ContextSchema = z.object({
  requirement: z.string(),
  implementation: z.string(),
  impact: z.string(),
  stakeholder: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high'])
})

const PatternSchema = z.object({
  name: z.string(),
  description: z.string(),
  pattern: z.string(),
  examples: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  frequency: z.number().min(1)
})

export class KnowledgeSynthesizer {
  constructor(private aiProvider: AIProvider) {}

  async synthesizeKnowledge(context: SynthesisContext): Promise<SynthesisResult> {
    const startTime = Date.now()
    
    try {
      const [insights, decisions, businessContext, patterns] = await Promise.all([
        this.extractInsights(context),
        this.extractDecisions(context),
        this.extractBusinessContext(context),
        this.identifyPatterns(context)
      ])

      const clusters = await this.createClusters([...insights, ...context.existingKnowledge])

      return {
        newInsights: insights,
        updatedInsights: [],
        newDecisions: decisions,
        newContext: businessContext,
        newPatterns: patterns,
        updatedClusters: clusters,
        confidence: this.calculateOverallConfidence([...insights, ...decisions]),
        processingTime: Date.now() - startTime
      }
    } catch (error) {
      console.error('Knowledge synthesis failed:', error)
      return {
        newInsights: [],
        updatedInsights: [],
        newDecisions: [],
        newContext: [],
        newPatterns: [],
        updatedClusters: [],
        confidence: 0,
        processingTime: Date.now() - startTime
      }
    }
  }

  private async extractInsights(context: SynthesisContext): Promise<KnowledgeInsight[]> {
    const prompt = `
You are an expert software architect analyzing Q&A responses from a developer about their codebase. Use your deep reasoning capabilities to extract technical insights, architectural learnings, and important discoveries.

Context:
- Session: ${context.sessionId}
- Code files discussed: ${context.codeContext.files.join(', ')}
- Functions mentioned: ${context.codeContext.functions.join(', ')}

Q&A Responses:
${context.responses.map(r => `
Q: ${r.question}
A: ${r.answer}
Existing insights: ${r.insights.join('; ')}
`).join('\n')}

Apply your reasoning to extract insights that:
1. Reveal WHY decisions were made (not just what was implemented)
2. Explain non-obvious technical choices and their implications
3. Document important architectural patterns and their trade-offs
4. Capture business logic reasoning and domain knowledge
5. Identify potential improvements, risks, or technical debt
6. Connect seemingly unrelated decisions to broader system design

Think step-by-step about each response and identify the deeper technical and architectural knowledge that would help future developers understand not just the code, but the reasoning behind it.

Focus on actionable knowledge that demonstrates the thought process and decision-making patterns of the development team.
`

    try {
      const result = await generateObject({
        model: await this.aiProvider.getModelWithFallback(),
        schema: z.object({
          insights: z.array(InsightSchema)
        }),
        prompt
      })

      return result.object.insights.map(insight => ({
        id: crypto.randomUUID(),
        topic: insight.topic,
        insight: insight.insight,
        confidence: insight.confidence,
        sources: context.responses.map(r => r.questionId),
        area: this.determineArea(context.codeContext.files),
        category: insight.category,
        impact: insight.impact,
        created: new Date()
      }))
    } catch (error) {
      console.error('Failed to extract insights:', error)
      return []
    }
  }

  private async extractDecisions(context: SynthesisContext): Promise<ArchitecturalDecision[]> {
    const prompt = `
You are an experienced software architect analyzing Q&A responses to identify key architectural decisions. Use your reasoning skills to understand the decision-making process behind code implementations.

Context:
- Code files: ${context.codeContext.files.join(', ')}
- Recent changes: ${context.codeContext.changes.join(', ')}

Q&A Data:
${context.responses.map(r => `Q: ${r.question}\nA: ${r.answer}`).join('\n\n')}

Reason through the responses to identify architectural decisions by:
1. Technology choices (frameworks, libraries, patterns) - analyze WHY these were chosen
2. Design decisions (architecture, data structures, APIs) - understand the reasoning process
3. Trade-offs that were made - identify what was sacrificed and what was gained
4. Alternative approaches that were considered or rejected - understand the decision matrix
5. Constraints that influenced decisions - technical, business, or resource limitations
6. Long-term implications - how these decisions affect future development

Think step-by-step about each decision:
- What problem was being solved?
- What options were available?
- What factors influenced the choice?
- What are the implications?

Only extract decisions that are clearly articulated with solid reasoning and evidence from the responses.
`

    try {
      const result = await generateObject({
        model: await this.aiProvider.getModelWithFallback(),
        schema: z.object({
          decisions: z.array(DecisionSchema)
        }),
        prompt
      })

      return result.object.decisions.map(decision => ({
        id: crypto.randomUUID(),
        decision: decision.decision,
        rationale: decision.rationale,
        alternatives: decision.alternatives,
        tradeoffs: decision.tradeoffs,
        context: decision.context,
        area: this.determineArea(context.codeContext.files),
        confidence: decision.confidence,
        sources: context.responses.map(r => r.questionId),
        created: new Date()
      }))
    } catch (error) {
      console.error('Failed to extract decisions:', error)
      return []
    }
  }

  private async extractBusinessContext(context: SynthesisContext): Promise<BusinessContext[]> {
    const prompt = `
Extract business context and requirements from the Q&A responses.

Q&A Data:
${context.responses.map(r => `Q: ${r.question}\nA: ${r.answer}`).join('\n\n')}

Look for:
1. Business requirements that drove technical decisions
2. User needs and use cases
3. Performance or scalability requirements
4. Compliance or security requirements
5. Stakeholder concerns or constraints

Extract the business "why" behind technical implementations.
`

    try {
      const result = await generateObject({
        model: await this.aiProvider.getModelWithFallback(),
        schema: z.object({
          contexts: z.array(ContextSchema)
        }),
        prompt
      })

      return result.object.contexts.map(ctx => ({
        id: crypto.randomUUID(),
        requirement: ctx.requirement,
        implementation: ctx.implementation,
        impact: ctx.impact,
        stakeholder: ctx.stakeholder,
        priority: ctx.priority,
        area: this.determineArea(context.codeContext.files),
        sources: context.responses.map(r => r.questionId),
        created: new Date()
      }))
    } catch (error) {
      console.error('Failed to extract business context:', error)
      return []
    }
  }

  private async identifyPatterns(context: SynthesisContext): Promise<KnowledgePattern[]> {
    const prompt = `
Identify recurring patterns in the Q&A responses that could help understand this codebase.

Data:
${context.responses.map(r => `${r.question} -> ${r.answer}`).join('\n')}

Look for:
1. Coding patterns that appear multiple times
2. Problem-solving approaches
3. Common architectural choices
4. Repeated explanations of similar concepts
5. Standard practices or conventions

Extract patterns that would be useful for onboarding new developers.
`

    try {
      const result = await generateObject({
        model: await this.aiProvider.getModelWithFallback(),
        schema: z.object({
          patterns: z.array(PatternSchema)
        }),
        prompt
      })

      return result.object.patterns.map(pattern => ({
        id: crypto.randomUUID(),
        name: pattern.name,
        description: pattern.description,
        pattern: pattern.pattern,
        examples: pattern.examples,
        confidence: pattern.confidence,
        frequency: pattern.frequency,
        relatedItems: context.responses.map(r => r.questionId),
        createdAt: new Date(),
        updatedAt: new Date()
      }))
    } catch (error) {
      console.error('Failed to identify patterns:', error)
      return []
    }
  }

  private async createClusters(insights: KnowledgeInsight[]): Promise<KnowledgeCluster[]> {
    if (insights.length < 3) {
      return []
    }

    const prompt = `
Group the following insights into logical clusters based on their topics and relationships.

Insights:
${insights.map(i => `- ${i.topic}: ${i.insight}`).join('\n')}

Create clusters that:
1. Group related insights together
2. Have coherent themes
3. Would be useful for knowledge discovery
4. Represent different aspects of the codebase

Provide cluster names and descriptions that clearly explain what each cluster represents.
`

    try {
      const result = await generateText({
        model: await this.aiProvider.getModelWithFallback(),
        prompt
      })

      const clusterText = result.text
      const clusters: KnowledgeCluster[] = []

      const clusterMatches = clusterText.match(/Cluster \d+: (.+?)\n([\s\S]*?)(?=Cluster \d+:|$)/g)
      
      if (clusterMatches) {
        for (const match of clusterMatches) {
          const [, name] = match.match(/Cluster \d+: (.+)/) || []
          const description = match.split('\n').slice(1).join(' ').trim()
          
          if (name && description) {
            clusters.push({
              id: crypto.randomUUID(),
              name: name.trim(),
              description: description.substring(0, 500),
              items: insights.slice(0, 5).map(i => i.id),
              patterns: [],
              insights: insights.slice(0, 3).map(i => i.id),
              confidence: 0.7,
              createdAt: new Date(),
              updatedAt: new Date(),
              metadata: {
                size: insights.length,
                coherence: 0.8,
                coverage: insights.map(i => i.area)
              }
            })
          }
        }
      }

      return clusters
    } catch (error) {
      console.error('Failed to create clusters:', error)
      return []
    }
  }

  private determineArea(files: string[]): string {
    if (files.length === 0) return 'general'
    
    const commonDirs = files
      .map(f => f.split('/').slice(0, -1).join('/'))
      .filter(dir => dir.length > 0)
    
    if (commonDirs.length === 0) return 'root'
    
    const mostCommon = commonDirs
      .reduce((acc, dir) => {
        acc[dir] = (acc[dir] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    
    return Object.entries(mostCommon)
      .sort(([,a], [,b]) => b - a)[0][0] || 'general'
  }

  private calculateOverallConfidence(items: Array<{ confidence: number }>): number {
    if (items.length === 0) return 0
    return items.reduce((sum, item) => sum + item.confidence, 0) / items.length
  }

  async synthesizeFromSession(
    sessionId: string,
    responses: any[],
    codeContext: any,
    existingKnowledge: KnowledgeInsight[] = []
  ): Promise<SynthesisResult> {
    const context: SynthesisContext = {
      sessionId,
      responses: responses.map(r => ({
        questionId: r.questionId || crypto.randomUUID(),
        answerId: r.id || crypto.randomUUID(),
        question: r.question || '',
        answer: r.answer || '',
        insights: r.insights || [],
        timestamp: r.timestamp || new Date()
      })),
      codeContext: {
        files: codeContext.files || [],
        functions: codeContext.functions || [],
        changes: codeContext.changes || []
      },
      existingKnowledge
    }

    return this.synthesizeKnowledge(context)
  }
}