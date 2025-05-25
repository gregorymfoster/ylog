/**
 * AI utility functions for prompt generation and response processing
 */

import { QuestionPrompt, QuestionGenerationContext } from '../types/questions.js'
import { QuestionTarget, QuestionType } from '../types/core.js'

export class AIPromptGenerator {
  
  /**
   * Generate a context analysis prompt for understanding code
   */
  generateContextAnalysisPrompt(
    filePath: string,
    content: string,
    gitBlame: string,
    dependencies: string[]
  ): string {
    return `Analyze this code file to understand its purpose, complexity, and context needs.

**File:** ${filePath}

**Dependencies:** ${dependencies.join(', ') || 'None'}

**Git History:** 
${gitBlame}

**Code Content:**
\`\`\`
${content.slice(0, 2000)}${content.length > 2000 ? '\n... (truncated)' : ''}
\`\`\`

Please provide:
1. **Purpose**: What does this code do?
2. **Complexity**: Is this code complex or simple? Why?
3. **Context Gaps**: What information would help understand this better?
4. **Question Areas**: What aspects would benefit from developer insight?

Keep your response concise and focused on areas where human context would be valuable.`
  }

  /**
   * Generate question prompts for different question types
   */
  generateQuestionPrompt(target: QuestionTarget, questionType: QuestionType): QuestionPrompt {
    const baseContext = this.buildContextDescription(target)
    
    switch (questionType) {
      case 'why':
        return {
          systemPrompt: this.getSystemPrompt('why'),
          contextPrompt: baseContext,
          questionTemplate: this.getWhyQuestionTemplate(),
          optionsTemplate: this.getWhyOptionsTemplate()
        }
      
      case 'alternatives':
        return {
          systemPrompt: this.getSystemPrompt('alternatives'),
          contextPrompt: baseContext,
          questionTemplate: this.getAlternativesQuestionTemplate(),
          optionsTemplate: this.getAlternativesOptionsTemplate()
        }
      
      case 'tradeoffs':
        return {
          systemPrompt: this.getSystemPrompt('tradeoffs'),
          contextPrompt: baseContext,
          questionTemplate: this.getTradeoffsQuestionTemplate(),
          optionsTemplate: this.getTradeoffsOptionsTemplate()
        }
      
      case 'business':
        return {
          systemPrompt: this.getSystemPrompt('business'),
          contextPrompt: baseContext,
          questionTemplate: this.getBusinessQuestionTemplate(),
          optionsTemplate: this.getBusinessOptionsTemplate()
        }
      
      case 'performance':
        return {
          systemPrompt: this.getSystemPrompt('performance'),
          contextPrompt: baseContext,
          questionTemplate: this.getPerformanceQuestionTemplate(),
          optionsTemplate: this.getPerformanceOptionsTemplate()
        }
      
      case 'security':
        return {
          systemPrompt: this.getSystemPrompt('security'),
          contextPrompt: baseContext,
          questionTemplate: this.getSecurityQuestionTemplate(),
          optionsTemplate: this.getSecurityOptionsTemplate()
        }
      
      default:
        return this.generateQuestionPrompt(target, 'why')
    }
  }

  /**
   * Build context description from question target
   */
  private buildContextDescription(target: QuestionTarget): string {
    const { area, context } = target
    
    return `**File/Area:** ${area.path}
**Language:** ${area.language || 'unknown'}
**Complexity:** ${area.complexity}/10
**Recent Changes:** ${context.recentChanges.length > 0 ? 'Yes' : 'No'}
**Dependencies:** ${context.dependencies.length}

**Code Context:**
\`\`\`
${context.fileContent.slice(0, 1500)}${context.fileContent.length > 1500 ? '\n... (truncated)' : ''}
\`\`\`

**Recent Git Activity:**
${context.recentChanges.slice(0, 3).map(change => 
  `- ${change.author}: ${change.summary} (${change.linesChanged} lines)`
).join('\n') || 'No recent changes'}

**Related Files:**
${context.relatedFiles.slice(0, 5).join('\n') || 'None identified'}`
  }

  /**
   * System prompts for different question types
   */
  private getSystemPrompt(type: QuestionType): string {
    const basePrompt = `You are an expert software architect with deep reasoning capabilities conducting an interactive knowledge-gathering session. Your goal is to understand the "why" behind code decisions and capture institutional knowledge that would help future developers.

Analyze the provided code context step-by-step and reason about what knowledge gaps exist. Generate ONE focused, insightful question that would help understand the reasoning behind the code.

The question should be:
- Specific to the code context provided
- Answerable by the developer who wrote or modified the code  
- Valuable for future developers to understand the decision-making process
- Clear and concise, but thought-provoking
- Designed to uncover implicit knowledge and reasoning

Think through potential answers and provide 3-4 multiple choice options plus an "Other" option. Make the options realistic alternatives that a developer might have actually considered, based on your reasoning about the problem space.`

    switch (type) {
      case 'why':
        return basePrompt + '\n\nReason through the code to understand the fundamental logic behind the implementation approach. What problem was being solved, and why was this particular solution chosen?'
      
      case 'alternatives':
        return basePrompt + '\n\nAnalyze the implementation and think about what other approaches could have been used. Focus on understanding the decision matrix that led to this choice over alternatives.'
      
      case 'tradeoffs':
        return basePrompt + '\n\nExamine the implementation for compromises and trade-offs. What was gained and what was sacrificed? Consider performance, maintainability, complexity, and other factors.'
      
      case 'business':
        return basePrompt + '\n\nConnect the technical implementation to business value. What user needs or business requirements drove this specific technical approach?'
      
      case 'performance':
        return basePrompt + '\n\nAnalyze the code for performance implications. What performance considerations influenced the design, and what optimizations were made or avoided?'
      
      case 'security':
        return basePrompt + '\n\nExamine the code through a security lens. What security considerations influenced the implementation, and what threats were being mitigated?'
      
      default:
        return basePrompt
    }
  }

  /**
   * Question templates for different types
   */
  private getWhyQuestionTemplate(): string {
    return `Based on the code context, generate a question that asks about the fundamental reasoning behind the implementation approach. Examples:

- "Why did you implement X using Y approach?"
- "Why was this pattern chosen for this functionality?"
- "Why does this code handle Z in this particular way?"

Make it specific to the actual code provided.`
  }

  private getAlternativesQuestionTemplate(): string {
    return `Generate a question about alternative approaches that were considered. Examples:

- "What alternatives did you consider for implementing X?"
- "Why choose this library/framework over alternatives?"
- "What other patterns were considered for this use case?"

Focus on decision-making process.`
  }

  private getTradeoffsQuestionTemplate(): string {
    return `Generate a question about trade-offs and compromises made. Examples:

- "What trade-offs did you make in this implementation?"
- "Why accept the complexity/performance cost of this approach?"
- "What did you sacrifice to achieve X benefit?"

Focus on conscious compromises.`
  }

  private getBusinessQuestionTemplate(): string {
    return `Generate a question about business requirements or user needs. Examples:

- "What business requirement drove this implementation?"
- "How does this serve our users' needs?"
- "What problem does this solve for the product?"

Focus on business context.`
  }

  private getPerformanceQuestionTemplate(): string {
    return `Generate a question about performance considerations. Examples:

- "What performance requirements influenced this design?"
- "Why optimize this particular operation?"
- "How does this impact system performance?"

Focus on performance reasoning.`
  }

  private getSecurityQuestionTemplate(): string {
    return `Generate a question about security considerations. Examples:

- "What security threats does this protect against?"
- "Why implement this security measure here?"
- "How does this enforce security policies?"

Focus on security reasoning.`
  }

  /**
   * Option templates for multiple choice
   */
  private getWhyOptionsTemplate(): string {
    return `Provide 3-4 realistic options for why this approach was chosen:
A) [Technical reason - performance, maintainability, etc.]
B) [Architectural reason - fits the system design, etc.]  
C) [Practical reason - time constraints, existing code, etc.]
D) Other (please specify)`
  }

  private getAlternativesOptionsTemplate(): string {
    return `Provide 3-4 realistic alternatives that were likely considered:
A) [Alternative approach/library/pattern 1]
B) [Alternative approach/library/pattern 2]
C) [Alternative approach/library/pattern 3]
D) Other (please specify)`
  }

  private getTradeoffsOptionsTemplate(): string {
    return `Provide 3-4 realistic trade-offs:
A) [Performance vs. Simplicity]
B) [Speed vs. Accuracy]
C) [Maintainability vs. Features]
D) Other (please specify)`
  }

  private getBusinessOptionsTemplate(): string {
    return `Provide 3-4 realistic business drivers:
A) [User experience requirement]
B) [Business rule or compliance]
C) [Product roadmap priority]
D) Other (please specify)`
  }

  private getPerformanceOptionsTemplate(): string {
    return `Provide 3-4 realistic performance considerations:
A) [Speed/latency optimization]
B) [Memory/resource efficiency]
C) [Scalability requirement]
D) Other (please specify)`
  }

  private getSecurityOptionsTemplate(): string {
    return `Provide 3-4 realistic security considerations:
A) [Data protection/privacy]
B) [Access control/authorization]
C) [Attack prevention/mitigation]
D) Other (please specify)`
  }

  /**
   * Parse structured AI response into components
   */
  parseQuestionResponse(response: string): {
    question: string
    options: Array<{ key: string; text: string }>
    confidence: number
  } {
    const lines = response.split('\n').filter(line => line.trim())
    
    let question = ''
    const options: Array<{ key: string; text: string }> = []
    let confidence = 0.7 // Default confidence
    
    for (const line of lines) {
      // Extract question (usually marked with ?, or in quotes)
      if (line.includes('?') && !question) {
        question = line.replace(/^[*#\-\s]*/, '').trim()
      }
      
      // Extract options (A), B), etc.)
      const optionMatch = line.match(/^([A-D])\)\s*(.+)/)
      if (optionMatch) {
        options.push({
          key: optionMatch[1],
          text: optionMatch[2].trim()
        })
      }
      
      // Extract confidence if mentioned
      const confidenceMatch = line.match(/confidence[:\s]*(\d+(?:\.\d+)?)/i)
      if (confidenceMatch) {
        confidence = parseFloat(confidenceMatch[1])
        if (confidence > 1) confidence = confidence / 100 // Convert percentage
      }
    }
    
    return { question, options, confidence }
  }

  /**
   * Clean and validate user responses
   */
  cleanUserResponse(rawResponse: string): {
    selectedOption?: string
    freeformText?: string
    isValid: boolean
  } {
    const trimmed = rawResponse.trim()
    
    // Check for option selection (A, B, C, D)
    const optionMatch = trimmed.match(/^([A-D])(?:\)|\.|\s|$)/i)
    if (optionMatch) {
      const selectedOption = optionMatch[1].toUpperCase()
      const remaining = trimmed.substring(optionMatch[0].length).trim()
      
      return {
        selectedOption,
        freeformText: remaining || undefined,
        isValid: true
      }
    }
    
    // If no option selected, treat as freeform
    if (trimmed.length > 0) {
      return {
        freeformText: trimmed,
        isValid: true
      }
    }
    
    return { isValid: false }
  }
}