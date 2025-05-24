import inquirer from 'inquirer'
import chalk from 'chalk'
import { KnowledgeSearchEngine } from '../core/knowledge-search.js'
import { SQLiteKnowledgeStorage } from '../core/knowledge-storage.js'
import { ConsoleProgressVisualizer } from '../utils/progress-visualizer.js'
import { GamificationEngine } from '../core/gamification.js'
import { KnowledgeExporter } from '../core/knowledge-export.js'
import { AIProvider } from '../core/ai.js'
import { ResolvedYlog2Config } from '../types/config.js'
import {
  KnowledgeSearchResult,
  KnowledgeInsight,
  ArchitecturalDecision,
  BusinessContext
} from '../types/knowledge.js'

export class KnowledgeBrowser {
  private searchEngine: KnowledgeSearchEngine
  private storage: SQLiteKnowledgeStorage
  private visualizer: ConsoleProgressVisualizer
  private gamification: GamificationEngine
  private exporter: KnowledgeExporter

  constructor(config: ResolvedYlog2Config) {
    this.storage = new SQLiteKnowledgeStorage(`${config.outputDir}/knowledge/knowledge.db`)
    const aiProvider = new AIProvider(config)
    this.searchEngine = new KnowledgeSearchEngine(this.storage, aiProvider)
    this.visualizer = new ConsoleProgressVisualizer()
    this.gamification = new GamificationEngine(config.outputDir)
    this.exporter = new KnowledgeExporter(this.storage)
  }

  async start(): Promise<void> {
    console.clear()
    console.log(chalk.bold.blue('🧠 ylog2 Knowledge Browser'))
    console.log()
    
    try {
      await this.searchEngine.initialize()
      await this.showMainMenu()
    } catch (error) {
      console.error(chalk.red('Failed to initialize knowledge browser:'), error)
    }
  }

  private async showMainMenu(): Promise<void> {
    while (true) {
      console.log()
      const answer = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'What would you like to explore?',
        choices: [
          { name: '🔍 Search Knowledge', value: 'search' },
          { name: '💡 Browse Insights', value: 'insights' },
          { name: '🏗️  Browse Decisions', value: 'decisions' },
          { name: '🎯 Browse Business Context', value: 'context' },
          { name: '📊 Knowledge Statistics', value: 'stats' },
          { name: '🏆 User Progress', value: 'progress' },
          { name: '🔄 Get Recommendations', value: 'recommendations' },
          { name: '📤 Export Knowledge', value: 'export' },
          { name: '❌ Exit', value: 'exit' }
        ]
      }])

      switch (answer.action) {
        case 'search':
          await this.handleSearch()
          break
        case 'insights':
          await this.browseInsights()
          break
        case 'decisions':
          await this.browseDecisions()
          break
        case 'context':
          await this.browseBusinessContext()
          break
        case 'stats':
          await this.showStatistics()
          break
        case 'progress':
          await this.showUserProgress()
          break
        case 'recommendations':
          await this.showRecommendations()
          break
        case 'export':
          await this.exportKnowledge()
          break
        case 'exit':
          console.log(chalk.green('👋 Thank you for exploring your knowledge base!'))
          return
      }
    }
  }

  private async handleSearch(): Promise<void> {
    console.log()
    const searchQuery = await inquirer.prompt([{
      type: 'input',
      name: 'query',
      message: 'Enter your search query:',
      validate: (input: string) => input.trim().length > 0 || 'Please enter a search query'
    }])

    const filterOptions = await inquirer.prompt([{
      type: 'checkbox',
      name: 'types',
      message: 'What types of knowledge to search?',
      choices: [
        { name: 'Insights', value: 'insight', checked: true },
        { name: 'Decisions', value: 'decision', checked: true },
        { name: 'Business Context', value: 'context', checked: true }
      ],
      default: ['insight', 'decision', 'context']
    }])

    console.log()
    console.log(chalk.yellow('🔍 Searching...'))

    try {
      const results = await this.searchEngine.search(searchQuery.query, {
        type: filterOptions.types.length > 0 ? filterOptions.types : ['insight', 'decision', 'context'],
        limit: 10,
        semantic: true
      })

      this.displaySearchResults(results, searchQuery.query)
      
      if (results.length > 0) {
        await this.handleSearchResultSelection(results)
      }
    } catch (error) {
      console.error(chalk.red('Search failed:'), error)
    }
  }

  private displaySearchResults(results: KnowledgeSearchResult[], query: string): void {
    console.clear()
    console.log(chalk.bold.blue(`🔍 Search Results for "${query}"`))
    console.log()

    if (results.length === 0) {
      console.log(chalk.yellow('No results found. Try a different search term.'))
      return
    }

    results.forEach((result, index) => {
      const typeIcon = this.getTypeIcon(result.type)
      const relevanceBar = this.createRelevanceBar(result.relevance)
      
      console.log(`${chalk.bold(`${index + 1}.`)} ${typeIcon} ${chalk.bold(result.content.substring(0, 80))}${result.content.length > 80 ? '...' : ''}`)
      console.log(`   ${chalk.gray(`Area: ${result.area}`)} | ${relevanceBar}`)
      console.log(`   ${chalk.italic.gray(result.snippet)}`)
      console.log()
    })
  }

  private async handleSearchResultSelection(results: KnowledgeSearchResult[]): Promise<void> {
    const choices = results.map((result, index) => ({
      name: `${index + 1}. ${this.getTypeIcon(result.type)} ${result.content.substring(0, 60)}${result.content.length > 60 ? '...' : ''}`,
      value: index
    }))

    choices.push({ name: '🔙 Back to menu', value: -1 })

    const selection = await inquirer.prompt([{
      type: 'list',
      name: 'index',
      message: 'Select a result to view details:',
      choices
    }])

    if (selection.index >= 0) {
      await this.showResultDetails(results[selection.index])
    }
  }

  private async showResultDetails(result: KnowledgeSearchResult): Promise<void> {
    console.clear()
    console.log(chalk.bold.blue(`${this.getTypeIcon(result.type)} ${result.type.toUpperCase()} DETAILS`))
    console.log()
    
    console.log(chalk.bold('Content:'))
    console.log(result.content)
    console.log()
    
    console.log(chalk.bold('Area:'), result.area)
    console.log(chalk.bold('Relevance:'), this.createRelevanceBar(result.relevance))
    console.log(chalk.bold('Source:'), result.source)
    console.log()

    // Show related items
    try {
      const similar = await this.searchEngine.findSimilar(
        result.source, 
        result.type as 'insight' | 'decision' | 'context',
        3
      )

      if (similar.length > 0) {
        console.log(chalk.bold.cyan('🔗 Related Items:'))
        similar.forEach((item, index) => {
          console.log(`${index + 1}. ${this.getTypeIcon(item.type)} ${item.content.substring(0, 60)}...`)
        })
        console.log()
      }
    } catch (error) {
      // Silently fail if related items can't be found
    }

    await inquirer.prompt([{
      type: 'input',
      name: 'continue',
      message: 'Press Enter to continue...'
    }])
  }

  private async browseInsights(): Promise<void> {
    try {
      const knowledge = await this.storage.load()
      if (!knowledge || knowledge.insights.length === 0) {
        console.log(chalk.yellow('No insights found in the knowledge base.'))
        await this.pause()
        return
      }

      await this.displayItemList(
        knowledge.insights,
        '💡 INSIGHTS',
        (insight: KnowledgeInsight) => ({
          title: insight.topic,
          subtitle: insight.insight,
          metadata: `Confidence: ${(insight.confidence * 100).toFixed(1)}% | Area: ${insight.area}`
        })
      )
    } catch (error) {
      console.error(chalk.red('Failed to load insights:'), error)
    }
  }

  private async browseDecisions(): Promise<void> {
    try {
      const knowledge = await this.storage.load()
      if (!knowledge || knowledge.decisions.length === 0) {
        console.log(chalk.yellow('No architectural decisions found in the knowledge base.'))
        await this.pause()
        return
      }

      await this.displayItemList(
        knowledge.decisions,
        '🏗️ ARCHITECTURAL DECISIONS',
        (decision: ArchitecturalDecision) => ({
          title: decision.decision,
          subtitle: decision.rationale,
          metadata: `Confidence: ${(decision.confidence * 100).toFixed(1)}% | Area: ${decision.area}`
        })
      )
    } catch (error) {
      console.error(chalk.red('Failed to load decisions:'), error)
    }
  }

  private async browseBusinessContext(): Promise<void> {
    try {
      const knowledge = await this.storage.load()
      if (!knowledge || knowledge.businessContext.length === 0) {
        console.log(chalk.yellow('No business context found in the knowledge base.'))
        await this.pause()
        return
      }

      await this.displayItemList(
        knowledge.businessContext,
        '🎯 BUSINESS CONTEXT',
        (context: BusinessContext) => ({
          title: context.requirement,
          subtitle: context.implementation,
          metadata: `Priority: ${context.priority} | Area: ${context.area}`
        })
      )
    } catch (error) {
      console.error(chalk.red('Failed to load business context:'), error)
    }
  }

  private async displayItemList<T>(
    items: T[],
    title: string,
    formatter: (item: T) => { title: string; subtitle: string; metadata: string }
  ): Promise<void> {
    console.clear()
    console.log(chalk.bold.blue(title))
    console.log(chalk.gray(`Found ${items.length} items`))
    console.log()

    // Show paginated results
    const pageSize = 10
    let currentPage = 0
    const totalPages = Math.ceil(items.length / pageSize)

    while (true) {
      const startIndex = currentPage * pageSize
      const endIndex = Math.min(startIndex + pageSize, items.length)
      const pageItems = items.slice(startIndex, endIndex)

      console.clear()
      console.log(chalk.bold.blue(title))
      console.log(chalk.gray(`Page ${currentPage + 1} of ${totalPages} (${items.length} total)`))
      console.log()

      pageItems.forEach((item, index) => {
        const formatted = formatter(item)
        const globalIndex = startIndex + index + 1
        
        console.log(`${chalk.bold(`${globalIndex}.`)} ${chalk.bold(formatted.title.substring(0, 60))}${formatted.title.length > 60 ? '...' : ''}`)
        console.log(`   ${chalk.gray(formatted.subtitle.substring(0, 80))}${formatted.subtitle.length > 80 ? '...' : ''}`)
        console.log(`   ${chalk.italic.gray(formatted.metadata)}`)
        console.log()
      })

      const choices = []
      if (currentPage > 0) choices.push({ name: '⬅️  Previous page', value: 'prev' })
      if (currentPage < totalPages - 1) choices.push({ name: '➡️  Next page', value: 'next' })
      choices.push({ name: '🔙 Back to menu', value: 'back' })

      const action = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'Navigation:',
        choices
      }])

      switch (action.action) {
        case 'prev':
          currentPage--
          break
        case 'next':
          currentPage++
          break
        case 'back':
          return
      }
    }
  }

  private async showStatistics(): Promise<void> {
    console.clear()
    console.log(chalk.bold.blue('📊 KNOWLEDGE STATISTICS'))
    console.log()

    try {
      const metrics = await this.storage.getMetrics()
      const stats = this.searchEngine.getStats()

      console.log(chalk.bold('Knowledge Base Overview:'))
      console.log(`• Total Questions: ${chalk.cyan(metrics.totalQuestions.toString())}`)
      console.log(`• Total Insights: ${chalk.cyan(metrics.totalInsights.toString())}`)
      console.log(`• Total Decisions: ${chalk.cyan(metrics.totalDecisions.toString())}`)
      console.log(`• Average Confidence: ${chalk.cyan((metrics.averageConfidence * 100).toFixed(1) + '%')}`)
      console.log()

      console.log(chalk.bold('Search Index:'))
      console.log(`• Indexed Insights: ${chalk.cyan(stats.totalInsights.toString())}`)
      console.log(`• Indexed Decisions: ${chalk.cyan(stats.totalDecisions.toString())}`)
      console.log(`• Indexed Contexts: ${chalk.cyan(stats.totalContexts.toString())}`)
      console.log(`• Indexed Patterns: ${chalk.cyan(stats.totalPatterns.toString())}`)
      console.log()

      if (metrics.coverageByArea.size > 0) {
        console.log(chalk.bold('Knowledge by Area:'))
        for (const [area, count] of metrics.coverageByArea) {
          const percentage = (count / metrics.totalInsights * 100).toFixed(1)
          console.log(`• ${area}: ${chalk.cyan(count.toString())} (${percentage}%)`)
        }
        console.log()
      }

      await this.pause()
    } catch (error) {
      console.error(chalk.red('Failed to load statistics:'), error)
      await this.pause()
    }
  }

  private async showUserProgress(): Promise<void> {
    console.clear()
    console.log(chalk.bold.blue('🏆 USER PROGRESS'))
    console.log()

    try {
      const progress = await this.gamification.loadUserProgress()
      
      this.visualizer.showLevelProgress(progress)
      this.visualizer.showWeeklyProgress(progress)
      this.visualizer.showBadgeShowcase(progress)

      const milestones = this.gamification.getKnowledgeMilestones()
      this.visualizer.showKnowledgeMilestones(milestones)

      await this.pause()
    } catch (error) {
      console.error(chalk.red('Failed to load user progress:'), error)
      await this.pause()
    }
  }

  private async showRecommendations(): Promise<void> {
    console.clear()
    console.log(chalk.bold.blue('🔄 KNOWLEDGE RECOMMENDATIONS'))
    console.log()

    try {
      const recommendations = await this.searchEngine.getRecommendations()

      if (recommendations.insights.length > 0) {
        console.log(chalk.bold.yellow('💡 Top Insights:'))
        recommendations.insights.slice(0, 5).forEach((insight, index) => {
          console.log(`${index + 1}. ${insight.topic}`)
          console.log(`   ${chalk.gray(insight.insight.substring(0, 80))}...`)
        })
        console.log()
      }

      if (recommendations.decisions.length > 0) {
        console.log(chalk.bold.yellow('🏗️ Key Decisions:'))
        recommendations.decisions.slice(0, 3).forEach((decision, index) => {
          console.log(`${index + 1}. ${decision.decision}`)
          console.log(`   ${chalk.gray(decision.rationale.substring(0, 80))}...`)
        })
        console.log()
      }

      if (recommendations.suggestions.length > 0) {
        console.log(chalk.bold.yellow('🎯 Suggested Questions:'))
        recommendations.suggestions.forEach((suggestion, index) => {
          console.log(`${index + 1}. ${suggestion}`)
        })
        console.log()
      }

      await this.pause()
    } catch (error) {
      console.error(chalk.red('Failed to load recommendations:'), error)
      await this.pause()
    }
  }

  private async exportKnowledge(): Promise<void> {
    console.clear()
    console.log(chalk.bold.blue('📤 EXPORT KNOWLEDGE'))
    console.log()

    try {
      // Get export format
      const formatChoice = await inquirer.prompt([{
        type: 'list',
        name: 'format',
        message: 'Choose export format:',
        choices: [
          { name: '📄 JSON (structured data)', value: 'json' },
          { name: '📝 Markdown (readable format)', value: 'markdown' },
          { name: '📊 CSV (spreadsheet compatible)', value: 'csv' }
        ]
      }])

      // Get export options
      const options = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'includeMetadata',
          message: 'Include metadata (timestamps, version info)?',
          default: true
        },
        {
          type: 'input',
          name: 'filterByArea',
          message: 'Filter by area (leave empty for all areas):',
          default: ''
        },
        {
          type: 'number',
          name: 'filterByConfidence',
          message: 'Minimum confidence (0-100, leave empty for all):',
          default: null,
          validate: (input: number) => {
            if (input === null || input === undefined) return true
            return (input >= 0 && input <= 100) || 'Confidence must be between 0 and 100'
          }
        },
        {
          type: 'input',
          name: 'outputPath',
          message: 'Output file path (leave empty for auto-generated):',
          default: ''
        }
      ])

      const exportOptions = {
        format: formatChoice.format,
        includeMetadata: options.includeMetadata,
        filterByArea: options.filterByArea || undefined,
        filterByConfidence: options.filterByConfidence ? options.filterByConfidence / 100 : undefined,
        outputPath: options.outputPath || undefined
      }

      // Show export preview
      console.log()
      console.log(chalk.yellow('📊 Calculating export statistics...'))
      
      const stats = await this.exporter.getExportStats(exportOptions)
      
      console.log()
      console.log(chalk.bold('Export Preview:'))
      console.log(`• Format: ${formatChoice.format.toUpperCase()}`)
      console.log(`• Insights: ${chalk.cyan(stats.totalInsights.toString())}`)
      console.log(`• Decisions: ${chalk.cyan(stats.totalDecisions.toString())}`)
      console.log(`• Business Context: ${chalk.cyan(stats.totalContext.toString())}`)
      console.log(`• Areas: ${chalk.cyan(stats.areasIncluded.join(', ') || 'All')}`)
      console.log(`• Estimated size: ${chalk.cyan(stats.estimatedSize)}`)
      console.log()

      const confirm = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: 'Proceed with export?',
        default: true
      }])

      if (confirm.proceed) {
        console.log(chalk.yellow('📤 Exporting...'))
        
        const filePath = await this.exporter.exportToFile(exportOptions)
        
        console.log()
        console.log(chalk.green('✅ Export completed successfully!'))
        console.log(chalk.bold(`📁 File: ${filePath}`))
        console.log()
      }

    } catch (error) {
      console.error(chalk.red('Failed to export knowledge:'), error)
    }

    await this.pause()
  }

  private getTypeIcon(type: string): string {
    switch (type) {
      case 'insight': return '💡'
      case 'decision': return '🏗️'
      case 'context': return '🎯'
      case 'qa': return '❓'
      case 'pattern': return '🔄'
      case 'cluster': return '🗂️'
      default: return '📄'
    }
  }

  private createRelevanceBar(relevance: number): string {
    const width = 10
    const filled = Math.floor(relevance * width)
    const empty = width - filled
    const percentage = (relevance * 100).toFixed(0)
    
    return `${chalk.green('█'.repeat(filled))}${chalk.gray('░'.repeat(empty))} ${percentage}%`
  }

  private async pause(): Promise<void> {
    await inquirer.prompt([{
      type: 'input',
      name: 'continue',
      message: 'Press Enter to continue...'
    }])
  }
}