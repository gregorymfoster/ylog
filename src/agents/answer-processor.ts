/**
 * Answer processing and cleaning agent
 */

import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { ollama } from 'ollama-ai-provider'
import { AIPromptGenerator } from '../utils/ai-helpers.js'
import {
  UserResponse,
  ProcessedAnswer
} from '../types/questions.js'
import { ResolvedYlog2Config } from '../types/config.js'

export class AnswerProcessor {
  private config: ResolvedYlog2Config
  private promptGenerator: AIPromptGenerator

  constructor(config: ResolvedYlog2Config) {
    this.config = config
    this.promptGenerator = new AIPromptGenerator()
  }

  /**
   * Process and clean a user response
   */
  async processResponse(response: UserResponse): Promise<ProcessedAnswer> {
    // Clean and validate the raw response
    const cleaned = this.promptGenerator.cleanUserResponse(
      response.selectedOption || response.freeformText || ''
    )

    if (!cleaned.isValid) {
      throw new Error('Invalid response provided')
    }

    // Extract insights using AI if we have substantial text
    const insights = await this.extractInsights(response, cleaned)
    
    // Categorize the response
    const categories = this.categorizeResponse(cleaned)
    
    // Calculate confidence based on response quality
    const confidence = this.calculateConfidence(response, cleaned, insights)
    
    // Generate follow-up questions if appropriate
    const followUpQuestions = await this.generateFollowUpQuestions(response, cleaned)

    return {
      questionId: response.questionId,
      rawResponse: response,
      cleanedText: this.buildCleanedText(cleaned),
      extractedInsights: insights,
      categories,
      confidence,
      followUpQuestions,
      businessValue: this.extractBusinessValue(insights),
      technicalContext: this.extractTechnicalContext(insights)
    }
  }

  /**
   * Extract insights from the response using AI
   */
  private async extractInsights(
    response: UserResponse, 
    cleaned: any
  ): Promise<string[]> {
    const fullText = this.buildCleanedText(cleaned)
    
    // Only use AI for substantial responses
    if (fullText.length < 20) {
      return [fullText]
    }

    try {
      const model = this.getAIModel()
      
      const prompt = `Extract key insights from this developer response about their code decisions:

Response: "${fullText}"

Extract 1-3 key insights that would be valuable for future developers. Focus on:
- The reasoning behind decisions
- Business or technical drivers
- Trade-offs that were considered
- Important context that isn't obvious from the code

Return insights as a JSON array of strings, e.g.:
["Insight 1", "Insight 2", "Insight 3"]

If the response is too brief or doesn't contain meaningful insights, return: ["${fullText}"]`

      const result = await generateText({
        model,
        prompt,
        maxTokens: 200,
        temperature: 0.3
      })

      // Try to parse as JSON array
      try {
        const parsed = JSON.parse(result.text)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(insight => insight.toString().trim())
        }
      } catch {
        // Fallback to raw text if JSON parsing fails
      }

      // Fallback: split by newlines or periods
      const fallbackInsights = result.text
        .split(/[.\n]/)
        .map(s => s.trim())
        .filter(s => s.length > 10)
        .slice(0, 3)

      return fallbackInsights.length > 0 ? fallbackInsights : [fullText]
    } catch (error) {
      console.warn('Failed to extract insights with AI:', error)
      return [fullText]
    }
  }

  /**
   * Categorize the response
   */
  private categorizeResponse(cleaned: any): string[] {
    const categories: string[] = []
    const text = this.buildCleanedText(cleaned).toLowerCase()

    // Technical categories
    if (text.match(/performance|speed|fast|slow|optimization|efficiency/)) {
      categories.push('performance')
    }
    if (text.match(/security|auth|permission|vulnerability|attack|safe/)) {
      categories.push('security')
    }
    if (text.match(/architecture|design|pattern|structure|framework/)) {
      categories.push('architecture')
    }
    if (text.match(/test|testing|spec|coverage|quality/)) {
      categories.push('testing')
    }
    if (text.match(/maintainable|readable|clean|refactor|legacy/)) {
      categories.push('maintainability')
    }

    // Business categories
    if (text.match(/user|customer|business|requirement|product|feature/)) {
      categories.push('business')
    }
    if (text.match(/deadline|time|quick|fast|urgent|schedule/)) {
      categories.push('timeline')
    }
    if (text.match(/cost|budget|resource|team|capacity/)) {
      categories.push('resources')
    }

    // Process categories
    if (text.match(/existing|legacy|migration|compatibility|breaking/)) {
      categories.push('compatibility')
    }
    if (text.match(/simple|easy|complex|difficult|complicated/)) {
      categories.push('complexity')
    }

    // Default if no categories found
    if (categories.length === 0) {
      categories.push('general')
    }

    return categories
  }

  /**
   * Calculate confidence score for the response
   */
  private calculateConfidence(
    response: UserResponse,
    cleaned: any,
    insights: string[]
  ): number {
    let confidence = 0.5 // Base confidence
    
    const text = this.buildCleanedText(cleaned)
    
    // Boost for longer, more detailed responses
    if (text.length > 50) confidence += 0.2
    if (text.length > 150) confidence += 0.1
    
    // Boost for specific technical terms
    const technicalTerms = text.match(/\b(performance|security|architecture|pattern|requirement|business|user|test)\b/gi)
    if (technicalTerms) {
      confidence += Math.min(technicalTerms.length * 0.05, 0.2)
    }
    
    // Boost for multiple choice selection + explanation
    if (cleaned.selectedOption && cleaned.freeformText) {
      confidence += 0.15
    }
    
    // Boost for fast response (shows confidence)
    if (response.responseTime < 30) {
      confidence += 0.05
    }
    
    // Penalty for very short responses
    if (text.length < 10) {
      confidence -= 0.3
    }
    
    // Boost for multiple insights extracted
    if (insights.length > 1) {
      confidence += 0.1
    }
    
    return Math.max(0, Math.min(1, confidence))
  }

  /**
   * Generate follow-up questions based on response
   */
  private async generateFollowUpQuestions(
    response: UserResponse,
    cleaned: any
  ): Promise<string[]> {
    const text = this.buildCleanedText(cleaned)
    
    // Only generate follow-ups for substantial responses
    if (text.length < 30) {
      return []
    }

    const followUps: string[] = []
    
    // Pattern-based follow-up generation
    if (text.match(/alternative|option|choice/i)) {
      followUps.push("What other alternatives did you consider?")
    }
    
    if (text.match(/trade-?off|compromise|balance/i)) {
      followUps.push("What did you have to give up to achieve this?")
    }
    
    if (text.match(/performance|speed|optimization/i)) {
      followUps.push("How did you measure the performance impact?")
    }
    
    if (text.match(/business|user|customer|requirement/i)) {
      followUps.push("Which stakeholders were involved in this decision?")
    }
    
    if (text.match(/team|discussion|meeting/i)) {
      followUps.push("How was this decision communicated to the team?")
    }
    
    // Limit to 2 follow-ups to avoid overwhelming
    return followUps.slice(0, 2)
  }

  /**
   * Extract business value from insights
   */
  private extractBusinessValue(insights: string[]): string {
    const businessTerms = /\b(user|customer|business|product|feature|requirement|revenue|cost|time|deadline|market|competitive)\b/gi
    
    for (const insight of insights) {
      if (businessTerms.test(insight)) {
        return insight
      }
    }
    
    return ''
  }

  /**
   * Extract technical context from insights
   */
  private extractTechnicalContext(insights: string[]): string {
    const technicalTerms = /\b(performance|security|architecture|pattern|framework|library|algorithm|database|api|service)\b/gi
    
    for (const insight of insights) {
      if (technicalTerms.test(insight)) {
        return insight
      }
    }
    
    return ''
  }

  /**
   * Build cleaned text from response
   */
  private buildCleanedText(cleaned: any): string {
    const parts: string[] = []
    
    if (cleaned.selectedOption) {
      parts.push(`Selected: ${cleaned.selectedOption}`)
    }
    
    if (cleaned.freeformText) {
      parts.push(cleaned.freeformText)
    }
    
    return parts.join(' - ')
  }

  /**
   * Get AI model for processing
   */
  private getAIModel() {
    const { provider, model, apiKey, endpoint } = this.config.ai
    
    switch (provider) {
      case 'anthropic':
        if (!apiKey && !process.env.ANTHROPIC_API_KEY) {
          throw new Error('Anthropic API key required')
        }
        return anthropic(model)
      
      case 'ollama':
        return ollama(model, { baseURL: endpoint })
      
      default:
        throw new Error(`Unsupported AI provider: ${provider}`)
    }
  }

  /**
   * Batch process multiple responses
   */
  async processBatch(responses: UserResponse[]): Promise<ProcessedAnswer[]> {
    const results: ProcessedAnswer[] = []
    
    // Process in small batches to avoid overwhelming AI
    const batchSize = 3
    for (let i = 0; i < responses.length; i += batchSize) {
      const batch = responses.slice(i, i + batchSize)
      
      const batchPromises = batch.map(response => 
        this.processResponse(response).catch(error => {
          console.warn(`Failed to process response ${response.questionId}: ${error}`)
          return null
        })
      )
      
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults.filter(r => r !== null) as ProcessedAnswer[])
    }
    
    return results
  }
}