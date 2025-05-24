/**
 * Output formatting utilities for ylog2
 */

import { KnowledgeInsight, ArchitecturalDecision, BusinessContext } from '../types/knowledge.js'
import { KnowledgeProgress } from '../types/core.js'

export class OutputFormatter {
  
  /**
   * Format progress for display
   */
  formatProgress(progress: KnowledgeProgress): string {
    const { areasWithContext, totalAreas, questionsAnswered, coveragePercentage } = progress
    
    const progressBar = this.createProgressBar(coveragePercentage / 100, 20)
    
    return `📊 Knowledge Progress:
${progressBar} ${coveragePercentage.toFixed(1)}%

📁 Areas: ${areasWithContext}/${totalAreas} with context
❓ Questions answered: ${questionsAnswered}
🧠 Insights generated: ${progress.insightsGenerated}`
  }

  /**
   * Create a visual progress bar
   */
  private createProgressBar(percentage: number, width: number): string {
    const filled = Math.round(percentage * width)
    const empty = width - filled
    return '█'.repeat(filled) + '░'.repeat(empty)
  }

  /**
   * Format session summary
   */
  formatSessionSummary(
    questionsAnswered: number,
    timeSpent: number,
    areasExplored: string[],
    newInsights: number
  ): string {
    const minutes = Math.round(timeSpent / 60)
    
    return `🎯 Session Summary:
⏱️  Time: ${minutes} minutes
❓ Questions answered: ${questionsAnswered}
🗂️  Areas explored: ${areasExplored.length}
💡 New insights: ${newInsights}

📍 Areas covered:
${areasExplored.map(area => `  • ${area}`).join('\n')}`
  }

  /**
   * Format insights for display
   */
  formatInsights(insights: KnowledgeInsight[], maxDisplay: number = 5): string {
    if (insights.length === 0) {
      return '💡 No insights generated yet'
    }

    const topInsights = insights
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxDisplay)

    return `💡 Key Insights:

${topInsights.map((insight, i) => 
  `${i + 1}. **${insight.topic}** (${insight.area})
   ${insight.insight}
   ${this.formatConfidence(insight.confidence)}`
).join('\n\n')}`
  }

  /**
   * Format architectural decisions
   */
  formatDecisions(decisions: ArchitecturalDecision[], maxDisplay: number = 3): string {
    if (decisions.length === 0) {
      return '🏗️  No architectural decisions documented yet'
    }

    const topDecisions = decisions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxDisplay)

    return `🏗️  Architectural Decisions:

${topDecisions.map((decision, i) => 
  `${i + 1}. **${decision.decision}** (${decision.area})
   
   **Why:** ${decision.rationale}
   
   **Alternatives:** ${decision.alternatives.join(', ') || 'None specified'}
   
   **Trade-offs:** ${decision.tradeoffs}
   ${this.formatConfidence(decision.confidence)}`
).join('\n\n')}`
  }

  /**
   * Format business context
   */
  formatBusinessContext(contexts: BusinessContext[], maxDisplay: number = 3): string {
    if (contexts.length === 0) {
      return '💼 No business context documented yet'
    }

    const topContexts = contexts
      .sort((a, b) => this.priorityToNumber(b.priority) - this.priorityToNumber(a.priority))
      .slice(0, maxDisplay)

    return `💼 Business Context:

${topContexts.map((context, i) => 
  `${i + 1}. **${context.requirement}** (${context.area})
   
   **Implementation:** ${context.implementation}
   
   **Impact:** ${context.impact}
   
   **Priority:** ${this.formatPriority(context.priority)}`
).join('\n\n')}`
  }

  /**
   * Format confidence score
   */
  private formatConfidence(confidence: number): string {
    const percentage = Math.round(confidence * 100)
    const emoji = confidence >= 0.8 ? '🟢' : confidence >= 0.6 ? '🟡' : '🟠'
    return `${emoji} ${percentage}% confidence`
  }

  /**
   * Format priority level
   */
  private formatPriority(priority: 'low' | 'medium' | 'high'): string {
    const priorityMap = {
      low: '🔵 Low',
      medium: '🟡 Medium', 
      high: '🔴 High'
    }
    return priorityMap[priority]
  }

  /**
   * Convert priority to number for sorting
   */
  private priorityToNumber(priority: 'low' | 'medium' | 'high'): number {
    const priorityMap = { low: 1, medium: 2, high: 3 }
    return priorityMap[priority]
  }

  /**
   * Format area coverage report
   */
  formatAreaCoverage(areaProgress: Map<string, number>): string {
    if (areaProgress.size === 0) {
      return '📂 No areas analyzed yet'
    }

    const sortedAreas = Array.from(areaProgress.entries())
      .sort(([, a], [, b]) => b - a)

    return `📂 Area Coverage:

${sortedAreas.map(([area, coverage]) => {
  const bar = this.createProgressBar(coverage / 100, 10)
  const percentage = coverage.toFixed(0)
  return `${area.padEnd(20)} ${bar} ${percentage}%`
}).join('\n')}`
  }

  /**
   * Format question for interactive display
   */
  formatQuestion(
    question: string,
    options: Array<{ key: string; text: string }>,
    context: string
  ): string {
    return `${context}

❓ ${question}

${options.map(option => `${option.key}) ${option.text}`).join('\n')}

[Choose ${options.map(o => o.key).join(',')}, or type your own answer]:`
  }

  /**
   * Format follow-up prompt
   */
  formatFollowUp(prompt: string): string {
    return `📝 ${prompt}
> `
  }

  /**
   * Format celebration message
   */
  formatCelebration(milestone: string): string {
    const celebrations = [
      '🎉 Awesome!',
      '🌟 Great job!',
      '🚀 Excellent!',
      '⭐ Well done!',
      '🎯 Perfect!',
      '💫 Amazing!',
      '🔥 Fantastic!'
    ]
    
    const celebration = celebrations[Math.floor(Math.random() * celebrations.length)]
    return `${celebration} ${milestone}`
  }

  /**
   * Format error message
   */
  formatError(error: string, context?: string): string {
    return `❌ Error${context ? ` in ${context}` : ''}: ${error}`
  }

  /**
   * Format warning message
   */
  formatWarning(warning: string): string {
    return `⚠️  Warning: ${warning}`
  }

  /**
   * Format info message
   */
  formatInfo(info: string): string {
    return `ℹ️  ${info}`
  }

  /**
   * Format file path for display (truncate if too long)
   */
  formatFilePath(path: string, maxLength: number = 50): string {
    if (path.length <= maxLength) {
      return path
    }
    
    const fileName = path.split('/').pop() || path
    const remaining = maxLength - fileName.length - 3 // 3 for "..."
    
    if (remaining <= 0) {
      return `...${fileName}`
    }
    
    const pathStart = path.substring(0, remaining)
    return `${pathStart}.../${fileName}`
  }

  /**
   * Format time duration
   */
  formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = Math.round(seconds % 60)
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
    } else {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
    }
  }

  /**
   * Format impact message
   */
  formatImpact(area: string, improvement: number): string {
    const impactEmoji = improvement >= 25 ? '🚀' : improvement >= 15 ? '📈' : '📊'
    return `${impactEmoji} ${area} understanding +${improvement}%`
  }
}