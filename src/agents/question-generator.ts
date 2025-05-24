/**
 * AI-powered question generation agent
 */

import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { ollama } from 'ollama-ai-provider'
import { AIPromptGenerator } from '../utils/ai-helpers.js'
import {
  QuestionTarget,
  QuestionType,
  ResolvedYlog2Config
} from '../types/index.js'
import {
  Question,
  QuestionOption,
  QuestionMetadata
} from '../types/questions.js'

export class QuestionGenerator {
  private config: ResolvedYlog2Config
  private promptGenerator: AIPromptGenerator
  private questionCache: Map<string, Question> = new Map()

  constructor(config: ResolvedYlog2Config) {
    this.config = config
    this.promptGenerator = new AIPromptGenerator()
  }

  /**
   * Generate a question for a specific target
   */
  async generateQuestion(target: QuestionTarget): Promise<Question> {
    const cacheKey = this.createCacheKey(target)
    
    // Check cache first
    if (this.questionCache.has(cacheKey)) {
      return this.questionCache.get(cacheKey)!
    }

    // Determine question type based on target focus and adaptive difficulty
    const questionType = this.selectQuestionType(target)
    
    // Generate question using AI
    const question = await this.generateAIQuestion(target, questionType)
    
    // Cache the question
    this.questionCache.set(cacheKey, question)
    
    return question
  }

  /**
   * Generate multiple questions for a target (for parallel processing)
   */
  async generateQuestionBatch(
    targets: QuestionTarget[], 
    batchSize: number = 3
  ): Promise<Question[]> {
    const questions: Question[] = []
    
    // Process in batches to avoid overwhelming the AI
    for (let i = 0; i < targets.length; i += batchSize) {
      const batch = targets.slice(i, i + batchSize)
      
      const batchPromises = batch.map(target => 
        this.generateQuestion(target).catch(error => {
          console.warn(`Failed to generate question for ${target.area.path}: ${error}`)
          return null
        })
      )
      
      const batchResults = await Promise.all(batchPromises)
      questions.push(...batchResults.filter(q => q !== null) as Question[])
    }
    
    return questions
  }

  /**
   * Generate AI-powered question
   */
  private async generateAIQuestion(
    target: QuestionTarget, 
    questionType: QuestionType
  ): Promise<Question> {
    const model = this.getAIModel()
    const prompt = this.promptGenerator.generateQuestionPrompt(target, questionType)
    
    try {
      // Generate the question
      const result = await generateText({
        model,
        prompt: this.buildFullPrompt(prompt, target),
        maxTokens: this.config.ai.maxTokens,
        temperature: this.config.ai.temperature
      })

      // Parse the AI response
      const parsed = this.promptGenerator.parseQuestionResponse(result.text)
      
      if (!parsed.question) {
        throw new Error('AI failed to generate a valid question')
      }

      // Create question object
      const question: Question = {
        id: this.generateQuestionId(target, questionType),
        type: parsed.options.length > 0 ? 'hybrid' : 'freeform',
        text: parsed.question,
        context: this.formatQuestionContext(target),
        options: parsed.options.length > 0 ? parsed.options : undefined,
        target,
        metadata: {
          generated: new Date(),
          model: `${this.config.ai.provider}/${this.config.ai.model}`,
          confidence: parsed.confidence,
          category: questionType,
          estimatedAnswerTime: target.estimatedTime * 60 // Convert to seconds
        },
        followUpPrompt: this.generateFollowUpPrompt(questionType)
      }

      return question
    } catch (error) {
      throw new Error(`AI question generation failed: ${error}`)
    }
  }

  /**
   * Build the full prompt for AI
   */
  private buildFullPrompt(promptTemplate: any, target: QuestionTarget): string {
    return `${promptTemplate.systemPrompt}

${promptTemplate.contextPrompt}

${promptTemplate.questionTemplate}

${promptTemplate.optionsTemplate || ''}

Remember to:
1. Make the question specific to the code shown
2. Focus on the "why" behind decisions
3. Keep options realistic and commonly considered
4. Make it answerable by someone who worked on this code

Generate one clear question with 3-4 multiple choice options (A, B, C, D) plus option for "Other".`
  }

  /**
   * Select appropriate question type based on target and configuration
   */
  private selectQuestionType(target: QuestionTarget): QuestionType {
    const { questionTypes, adaptiveDifficulty } = this.config.questions
    
    // Use target focus if it matches configured types
    if (questionTypes.includes(target.focus as QuestionType)) {
      return target.focus as QuestionType
    }
    
    // Adaptive selection based on code characteristics
    if (adaptiveDifficulty) {
      const { area } = target
      
      // High complexity areas get architecture questions
      if (area.complexity > 30 && questionTypes.includes('architecture')) {
        return 'architecture'
      }
      
      // Recently changed files get "why" questions
      if (area.changeFrequency > 3 && questionTypes.includes('why')) {
        return 'why'
      }
      
      // Multiple contributors suggest trade-offs
      if (area.contributors.length > 3 && questionTypes.includes('tradeoffs')) {
        return 'tradeoffs'
      }
    }
    
    // Fallback to first configured type or 'why'
    return questionTypes[0] || 'why'
  }

  /**
   * Generate follow-up prompt based on question type
   */
  private generateFollowUpPrompt(questionType: QuestionType): string {
    const prompts = {
      why: "Any additional context about why this approach was chosen?",
      alternatives: "What other options did you consider?",
      tradeoffs: "What were the main trade-offs in this decision?",
      business: "How does this relate to business requirements?",
      performance: "Were there specific performance considerations?",
      security: "What security aspects influenced this design?",
      architecture: "How does this fit into the overall architecture?"
    }
    
    return prompts[questionType] || "Any additional context you'd like to share?"
  }

  /**
   * Format context information for display
   */
  private formatQuestionContext(target: QuestionTarget): string {
    const { area, context } = target
    const filePath = this.formatFilePath(area.path)
    
    let contextStr = `📁 ${filePath}`
    
    if (area.type === 'file') {
      contextStr += ` (${area.language || 'unknown'})`
    }
    
    if (area.complexity > 20) {
      contextStr += ` 🔥 High complexity (${area.complexity})`
    }
    
    if (area.changeFrequency > 0) {
      contextStr += ` 📈 ${area.changeFrequency} recent changes`
    }
    
    if (context.recentChanges.length > 0) {
      const latestChange = context.recentChanges[0]
      contextStr += `\n📝 Latest: ${latestChange.summary} by ${latestChange.author}`
    }
    
    return contextStr
  }

  /**
   * Format file path for display
   */
  private formatFilePath(path: string): string {
    const maxLength = 50
    if (path.length <= maxLength) return path
    
    const parts = path.split('/')
    const fileName = parts[parts.length - 1]
    const remaining = maxLength - fileName.length - 3 // for "..."
    
    if (remaining <= 0) return `...${fileName}`
    
    let truncated = ''
    let currentLength = 0
    
    for (const part of parts.slice(0, -1)) {
      if (currentLength + part.length + 1 <= remaining) {
        truncated += (truncated ? '/' : '') + part
        currentLength += part.length + 1
      } else {
        break
      }
    }
    
    return `${truncated}/.../${fileName}`
  }

  /**
   * Create cache key for question
   */
  private createCacheKey(target: QuestionTarget): string {
    const { area, focus } = target
    return `${area.path}:${focus}:${area.complexity}:${area.changeFrequency}`
  }

  /**
   * Generate unique question ID
   */
  private generateQuestionId(target: QuestionTarget, questionType: QuestionType): string {
    const timestamp = Date.now()
    const areaHash = this.simpleHash(target.area.path)
    return `q_${questionType}_${areaHash}_${timestamp}`
  }

  /**
   * Simple hash function for strings
   */
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * Get AI model based on configuration
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
   * Test AI connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const model = this.getAIModel()
      
      const result = await generateText({
        model,
        prompt: 'Respond with exactly: "Connected"',
        maxTokens: 10
      })
      
      return result.text.includes('Connected')
    } catch {
      return false
    }
  }

  /**
   * Get generation statistics
   */
  getStats(): { cacheSize: number; questionsGenerated: number } {
    return {
      cacheSize: this.questionCache.size,
      questionsGenerated: this.questionCache.size
    }
  }

  /**
   * Clear question cache
   */
  clearCache(): void {
    this.questionCache.clear()
  }
}