import { writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import {
  KnowledgeBase,
  KnowledgeInsight,
  ArchitecturalDecision,
  BusinessContext,
  KnowledgeMetrics
} from '../types/knowledge.js'
import { SQLiteKnowledgeStorage } from './knowledge-storage.js'

export interface ExportOptions {
  format: 'json' | 'markdown' | 'csv'
  includeMetadata: boolean
  filterByArea?: string
  filterByConfidence?: number
  outputPath?: string
}

export interface ImportOptions {
  format: 'json'
  mergeStrategy: 'replace' | 'merge' | 'skip_existing'
  validateData: boolean
}

export class KnowledgeExporter {
  constructor(private storage: SQLiteKnowledgeStorage) {}

  async exportKnowledge(options: ExportOptions): Promise<string> {
    const knowledge = await this.storage.load()
    if (!knowledge) {
      throw new Error('No knowledge base found to export')
    }

    // Apply filters
    const filteredKnowledge = this.applyFilters(knowledge, options)

    switch (options.format) {
      case 'json':
        return this.exportJSON(filteredKnowledge, options)
      case 'markdown':
        return this.exportMarkdown(filteredKnowledge, options)
      case 'csv':
        return this.exportCSV(filteredKnowledge, options)
      default:
        throw new Error(`Unsupported export format: ${options.format}`)
    }
  }

  async importKnowledge(filePath: string, options: ImportOptions): Promise<void> {
    const content = readFileSync(filePath, 'utf-8')

    switch (options.format) {
      case 'json':
        await this.importJSON(content, options)
        break
      default:
        throw new Error(`Unsupported import format: ${options.format}`)
    }
  }

  private applyFilters(knowledge: KnowledgeBase, options: ExportOptions): KnowledgeBase {
    let filteredInsights = knowledge.insights
    let filteredDecisions = knowledge.decisions
    let filteredContext = knowledge.businessContext

    // Filter by area
    if (options.filterByArea) {
      filteredInsights = filteredInsights.filter(i => i.area === options.filterByArea)
      filteredDecisions = filteredDecisions.filter(d => d.area === options.filterByArea)
      filteredContext = filteredContext.filter(c => c.area === options.filterByArea)
    }

    // Filter by confidence
    if (options.filterByConfidence !== undefined) {
      filteredInsights = filteredInsights.filter(i => i.confidence >= options.filterByConfidence!)
      filteredDecisions = filteredDecisions.filter(d => d.confidence >= options.filterByConfidence!)
    }

    return {
      ...knowledge,
      insights: filteredInsights,
      decisions: filteredDecisions,
      businessContext: filteredContext
    }
  }

  private exportJSON(knowledge: KnowledgeBase, options: ExportOptions): string {
    const exportData = {
      exportedAt: new Date().toISOString(),
      exportOptions: options,
      knowledge: {
        insights: knowledge.insights,
        decisions: knowledge.decisions,
        businessContext: knowledge.businessContext,
        ...(options.includeMetadata && {
          metadata: {
            version: knowledge.version,
            lastUpdated: knowledge.lastUpdated,
            totalAreas: knowledge.areas.size
          }
        })
      }
    }

    return JSON.stringify(exportData, null, 2)
  }

  private exportMarkdown(knowledge: KnowledgeBase, options: ExportOptions): string {
    const lines: string[] = []

    lines.push('# Knowledge Base Export')
    lines.push('')
    lines.push(`**Exported:** ${new Date().toISOString()}`)
    lines.push(`**Total Insights:** ${knowledge.insights.length}`)
    lines.push(`**Total Decisions:** ${knowledge.decisions.length}`)
    lines.push(`**Total Business Context:** ${knowledge.businessContext.length}`)
    lines.push('')

    // Export insights
    if (knowledge.insights.length > 0) {
      lines.push('## 💡 Insights')
      lines.push('')

      for (const insight of knowledge.insights) {
        lines.push(`### ${insight.topic}`)
        lines.push('')
        lines.push(insight.insight)
        lines.push('')
        lines.push(`**Area:** ${insight.area}`)
        lines.push(`**Category:** ${insight.category}`)
        lines.push(`**Impact:** ${insight.impact}`)
        lines.push(`**Confidence:** ${(insight.confidence * 100).toFixed(1)}%`)
        lines.push(`**Created:** ${insight.created.toLocaleDateString()}`)
        lines.push('')
        lines.push('---')
        lines.push('')
      }
    }

    // Export decisions
    if (knowledge.decisions.length > 0) {
      lines.push('## 🏗️ Architectural Decisions')
      lines.push('')

      for (const decision of knowledge.decisions) {
        lines.push(`### ${decision.decision}`)
        lines.push('')
        lines.push('**Rationale:**')
        lines.push(decision.rationale)
        lines.push('')
        
        if (decision.alternatives.length > 0) {
          lines.push('**Alternatives Considered:**')
          for (const alt of decision.alternatives) {
            lines.push(`- ${alt}`)
          }
          lines.push('')
        }

        lines.push('**Trade-offs:**')
        lines.push(decision.tradeoffs)
        lines.push('')
        lines.push('**Context:**')
        lines.push(decision.context)
        lines.push('')
        lines.push(`**Area:** ${decision.area}`)
        lines.push(`**Confidence:** ${(decision.confidence * 100).toFixed(1)}%`)
        lines.push(`**Created:** ${decision.created.toLocaleDateString()}`)
        lines.push('')
        lines.push('---')
        lines.push('')
      }
    }

    // Export business context
    if (knowledge.businessContext.length > 0) {
      lines.push('## 🎯 Business Context')
      lines.push('')

      for (const context of knowledge.businessContext) {
        lines.push(`### ${context.requirement}`)
        lines.push('')
        lines.push('**Implementation:**')
        lines.push(context.implementation)
        lines.push('')
        lines.push('**Impact:**')
        lines.push(context.impact)
        lines.push('')
        
        if (context.stakeholder) {
          lines.push(`**Stakeholder:** ${context.stakeholder}`)
        }
        
        lines.push(`**Priority:** ${context.priority}`)
        lines.push(`**Area:** ${context.area}`)
        lines.push(`**Created:** ${context.created.toLocaleDateString()}`)
        lines.push('')
        lines.push('---')
        lines.push('')
      }
    }

    return lines.join('\n')
  }

  private exportCSV(knowledge: KnowledgeBase, options: ExportOptions): string {
    const lines: string[] = []

    // CSV header
    lines.push('Type,Title,Content,Area,Category,Priority,Impact,Confidence,Created')

    // Export insights
    for (const insight of knowledge.insights) {
      const row = [
        'Insight',
        this.escapeCSV(insight.topic),
        this.escapeCSV(insight.insight),
        this.escapeCSV(insight.area),
        insight.category,
        '',
        insight.impact,
        (insight.confidence * 100).toFixed(1),
        insight.created.toISOString()
      ]
      lines.push(row.join(','))
    }

    // Export decisions
    for (const decision of knowledge.decisions) {
      const row = [
        'Decision',
        this.escapeCSV(decision.decision),
        this.escapeCSV(decision.rationale),
        this.escapeCSV(decision.area),
        '',
        '',
        '',
        (decision.confidence * 100).toFixed(1),
        decision.created.toISOString()
      ]
      lines.push(row.join(','))
    }

    // Export business context
    for (const context of knowledge.businessContext) {
      const row = [
        'Business Context',
        this.escapeCSV(context.requirement),
        this.escapeCSV(context.implementation),
        this.escapeCSV(context.area),
        '',
        context.priority,
        '',
        '',
        context.created.toISOString()
      ]
      lines.push(row.join(','))
    }

    return lines.join('\n')
  }

  private async importJSON(content: string, options: ImportOptions): Promise<void> {
    try {
      const data = JSON.parse(content)

      if (options.validateData && !this.validateImportData(data)) {
        throw new Error('Invalid import data format')
      }

      const knowledge = data.knowledge

      // Import insights
      for (const insight of knowledge.insights || []) {
        const existingKnowledge = await this.storage.load()
        const exists = existingKnowledge?.insights.some(i => i.id === insight.id)

        if (exists && options.mergeStrategy === 'skip_existing') {
          continue
        }

        await this.storage.addInsight({
          ...insight,
          created: new Date(insight.created)
        })
      }

      // Import decisions
      for (const decision of knowledge.decisions || []) {
        const existingKnowledge = await this.storage.load()
        const exists = existingKnowledge?.decisions.some(d => d.id === decision.id)

        if (exists && options.mergeStrategy === 'skip_existing') {
          continue
        }

        await this.storage.addDecision({
          ...decision,
          created: new Date(decision.created)
        })
      }

      // Import business context
      for (const context of knowledge.businessContext || []) {
        const existingKnowledge = await this.storage.load()
        const exists = existingKnowledge?.businessContext.some(c => c.id === context.id)

        if (exists && options.mergeStrategy === 'skip_existing') {
          continue
        }

        await this.storage.addContext({
          ...context,
          created: new Date(context.created)
        })
      }

    } catch (error) {
      throw new Error(`Failed to import JSON: ${error.message}`)
    }
  }

  private validateImportData(data: any): boolean {
    if (!data || typeof data !== 'object') return false
    if (!data.knowledge || typeof data.knowledge !== 'object') return false

    const { knowledge } = data

    // Validate insights
    if (knowledge.insights && Array.isArray(knowledge.insights)) {
      for (const insight of knowledge.insights) {
        if (!insight.id || !insight.topic || !insight.insight || !insight.area) {
          return false
        }
      }
    }

    // Validate decisions
    if (knowledge.decisions && Array.isArray(knowledge.decisions)) {
      for (const decision of knowledge.decisions) {
        if (!decision.id || !decision.decision || !decision.rationale || !decision.area) {
          return false
        }
      }
    }

    // Validate business context
    if (knowledge.businessContext && Array.isArray(knowledge.businessContext)) {
      for (const context of knowledge.businessContext) {
        if (!context.id || !context.requirement || !context.implementation || !context.area) {
          return false
        }
      }
    }

    return true
  }

  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  async exportToFile(options: ExportOptions): Promise<string> {
    const content = await this.exportKnowledge(options)
    
    let extension: string
    switch (options.format) {
      case 'json': extension = 'json'; break
      case 'markdown': extension = 'md'; break
      case 'csv': extension = 'csv'; break
      default: extension = 'txt'
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = options.outputPath || `ylog2-knowledge-${timestamp}.${extension}`
    
    writeFileSync(fileName, content, 'utf-8')
    return fileName
  }

  async getExportStats(options: ExportOptions): Promise<{
    totalInsights: number
    totalDecisions: number
    totalContext: number
    areasIncluded: string[]
    estimatedSize: string
  }> {
    const knowledge = await this.storage.load()
    if (!knowledge) {
      return {
        totalInsights: 0,
        totalDecisions: 0,
        totalContext: 0,
        areasIncluded: [],
        estimatedSize: '0 KB'
      }
    }

    const filtered = this.applyFilters(knowledge, options)
    const content = await this.exportKnowledge(options)
    const sizeInBytes = Buffer.byteLength(content, 'utf-8')
    const sizeInKB = (sizeInBytes / 1024).toFixed(1)

    const areas = new Set([
      ...filtered.insights.map(i => i.area),
      ...filtered.decisions.map(d => d.area),
      ...filtered.businessContext.map(c => c.area)
    ])

    return {
      totalInsights: filtered.insights.length,
      totalDecisions: filtered.decisions.length,
      totalContext: filtered.businessContext.length,
      areasIncluded: Array.from(areas),
      estimatedSize: `${sizeInKB} KB`
    }
  }
}