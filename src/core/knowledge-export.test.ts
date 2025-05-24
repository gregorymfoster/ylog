import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, rmSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { KnowledgeExporter } from './knowledge-export.js'
import { SQLiteKnowledgeStorage } from './knowledge-storage.js'
import { 
  KnowledgeInsight, 
  ArchitecturalDecision, 
  BusinessContext 
} from '../types/knowledge.js'

describe('KnowledgeExporter', () => {
  const testDataDir = join(__dirname, '../../test-data')
  const testDbPath = join(testDataDir, 'test-export.db')
  let storage: SQLiteKnowledgeStorage
  let exporter: KnowledgeExporter

  const sampleInsight: KnowledgeInsight = {
    id: 'insight-1',
    topic: 'Authentication Strategy',
    insight: 'We use JWT tokens for stateless authentication to improve scalability',
    confidence: 0.9,
    sources: ['question-1'],
    area: 'src/auth',
    category: 'technical',
    impact: 'high',
    created: new Date('2024-01-01')
  }

  const sampleDecision: ArchitecturalDecision = {
    id: 'decision-1',
    decision: 'Use React for frontend framework',
    rationale: 'React provides excellent component reusability and has strong community support',
    alternatives: ['Vue.js', 'Angular'],
    tradeoffs: 'Steeper learning curve but better long-term maintainability',
    context: 'Building a complex web application',
    area: 'frontend',
    confidence: 0.85,
    sources: ['question-2'],
    created: new Date('2024-01-02')
  }

  const sampleContext: BusinessContext = {
    id: 'context-1',
    requirement: 'Support user registration with email verification',
    implementation: 'Implemented email verification using SendGrid API',
    impact: 'Reduces spam accounts and improves user quality',
    stakeholder: 'Product Manager',
    priority: 'high',
    area: 'user-management',
    sources: ['question-3'],
    created: new Date('2024-01-03')
  }

  beforeEach(async () => {
    // Clean up test directory
    if (existsSync(testDataDir)) {
      rmSync(testDataDir, { recursive: true, force: true })
    }
    mkdirSync(testDataDir, { recursive: true })
    
    storage = new SQLiteKnowledgeStorage(testDbPath)
    await storage.initialize()
    
    exporter = new KnowledgeExporter(storage)
    
    // Add sample data
    await storage.addInsight(sampleInsight)
    await storage.addDecision(sampleDecision)
    await storage.addContext(sampleContext)
  })

  afterEach(async () => {
    await storage.cleanup()
    
    // Clean up test directory
    if (existsSync(testDataDir)) {
      rmSync(testDataDir, { recursive: true, force: true })
    }
  })

  describe('JSON Export', () => {
    it('should export complete knowledge base as JSON', async () => {
      const result = await exporter.exportKnowledge({
        format: 'json',
        includeMetadata: true
      })

      const data = JSON.parse(result)
      
      expect(data.exportedAt).toBeTruthy()
      expect(data.knowledge.insights).toHaveLength(1)
      expect(data.knowledge.decisions).toHaveLength(1)
      expect(data.knowledge.businessContext).toHaveLength(1)
      
      expect(data.knowledge.insights[0].topic).toBe(sampleInsight.topic)
      expect(data.knowledge.decisions[0].decision).toBe(sampleDecision.decision)
      expect(data.knowledge.businessContext[0].requirement).toBe(sampleContext.requirement)
    })

    it('should exclude metadata when specified', async () => {
      const result = await exporter.exportKnowledge({
        format: 'json',
        includeMetadata: false
      })

      const data = JSON.parse(result)
      
      expect(data.knowledge.metadata).toBeUndefined()
      expect(data.knowledge.insights).toBeTruthy()
    })

    it('should filter by area', async () => {
      const result = await exporter.exportKnowledge({
        format: 'json',
        includeMetadata: false,
        filterByArea: 'src/auth'
      })

      const data = JSON.parse(result)
      
      expect(data.knowledge.insights).toHaveLength(1)
      expect(data.knowledge.decisions).toHaveLength(0) // frontend area filtered out
      expect(data.knowledge.businessContext).toHaveLength(0) // user-management area filtered out
    })

    it('should filter by confidence', async () => {
      const result = await exporter.exportKnowledge({
        format: 'json',
        includeMetadata: false,
        filterByConfidence: 0.87 // Only insight (0.9) should pass
      })

      const data = JSON.parse(result)
      
      expect(data.knowledge.insights).toHaveLength(1)
      expect(data.knowledge.decisions).toHaveLength(0) // 0.85 confidence filtered out
    })
  })

  describe('Markdown Export', () => {
    it('should export as readable Markdown', async () => {
      const result = await exporter.exportKnowledge({
        format: 'markdown',
        includeMetadata: true
      })

      expect(result).toContain('# Knowledge Base Export')
      expect(result).toContain('## 💡 Insights')
      expect(result).toContain('## 🏗️ Architectural Decisions')
      expect(result).toContain('## 🎯 Business Context')
      
      expect(result).toContain(sampleInsight.topic)
      expect(result).toContain(sampleDecision.decision)
      expect(result).toContain(sampleContext.requirement)
      
      expect(result).toContain('**Area:**')
      expect(result).toContain('**Confidence:**')
      expect(result).toContain('**Rationale:**')
    })

    it('should handle alternatives in decisions', async () => {
      const result = await exporter.exportKnowledge({
        format: 'markdown',
        includeMetadata: false
      })

      expect(result).toContain('**Alternatives Considered:**')
      expect(result).toContain('- Vue.js')
      expect(result).toContain('- Angular')
    })
  })

  describe('CSV Export', () => {
    it('should export as CSV with proper headers', async () => {
      const result = await exporter.exportKnowledge({
        format: 'csv',
        includeMetadata: false
      })

      const lines = result.split('\n')
      
      expect(lines[0]).toBe('Type,Title,Content,Area,Category,Priority,Impact,Confidence,Created')
      expect(lines.length).toBeGreaterThan(3) // Header + 3 data rows
      
      expect(result).toContain('Insight')
      expect(result).toContain('Decision')
      expect(result).toContain('Business Context')
    })

    it('should escape CSV special characters', async () => {
      // Add insight with comma in content
      await storage.addInsight({
        ...sampleInsight,
        id: 'insight-2',
        insight: 'This insight has, commas and "quotes" in it'
      })

      const result = await exporter.exportKnowledge({
        format: 'csv',
        includeMetadata: false
      })

      expect(result).toContain('"This insight has, commas and ""quotes"" in it"')
    })
  })

  describe('File Export', () => {
    it('should export to file with correct extension', async () => {
      const filePath = await exporter.exportToFile({
        format: 'json',
        includeMetadata: true
      })

      expect(filePath).toMatch(/\.json$/)
      expect(existsSync(filePath)).toBe(true)
      
      const content = readFileSync(filePath, 'utf-8')
      const data = JSON.parse(content)
      expect(data.knowledge.insights).toHaveLength(1)
    })

    it('should use custom output path', async () => {
      const customPath = join(testDataDir, 'custom-export.json')
      
      const filePath = await exporter.exportToFile({
        format: 'json',
        includeMetadata: false,
        outputPath: customPath
      })

      expect(filePath).toBe(customPath)
      expect(existsSync(customPath)).toBe(true)
    })
  })

  describe('Export Statistics', () => {
    it('should provide accurate export statistics', async () => {
      const stats = await exporter.getExportStats({
        format: 'json',
        includeMetadata: true
      })

      expect(stats.totalInsights).toBe(1)
      expect(stats.totalDecisions).toBe(1)
      expect(stats.totalContext).toBe(1)
      expect(stats.areasIncluded).toContain('src/auth')
      expect(stats.areasIncluded).toContain('frontend')
      expect(stats.areasIncluded).toContain('user-management')
      expect(stats.estimatedSize).toMatch(/\d+\.\d+ KB/)
    })

    it('should calculate filtered statistics', async () => {
      const stats = await exporter.getExportStats({
        format: 'json',
        includeMetadata: false,
        filterByArea: 'frontend'
      })

      expect(stats.totalInsights).toBe(0)
      expect(stats.totalDecisions).toBe(1)
      expect(stats.totalContext).toBe(0)
      expect(stats.areasIncluded).toEqual(['frontend'])
    })
  })

  describe('Import', () => {
    it('should import valid JSON data', async () => {
      // First export data
      const exportedData = await exporter.exportKnowledge({
        format: 'json',
        includeMetadata: true
      })

      // Create new storage and import
      const newDbPath = join(testDataDir, 'import-test.db')
      const newStorage = new SQLiteKnowledgeStorage(newDbPath)
      await newStorage.initialize()
      
      const newExporter = new KnowledgeExporter(newStorage)
      
      // Write export to file for import
      const exportFile = join(testDataDir, 'export.json')
      require('fs').writeFileSync(exportFile, exportedData)
      
      await newExporter.importKnowledge(exportFile, {
        format: 'json',
        mergeStrategy: 'replace',
        validateData: true
      })

      const importedKnowledge = await newStorage.load()
      expect(importedKnowledge!.insights).toHaveLength(1)
      expect(importedKnowledge!.decisions).toHaveLength(1)
      expect(importedKnowledge!.businessContext).toHaveLength(1)
      
      await newStorage.cleanup()
    })

    it('should skip existing items when using skip_existing strategy', async () => {
      const exportedData = await exporter.exportKnowledge({
        format: 'json',
        includeMetadata: false
      })

      const exportFile = join(testDataDir, 'export.json')
      require('fs').writeFileSync(exportFile, exportedData)
      
      // Import into existing storage (should skip duplicates)
      await exporter.importKnowledge(exportFile, {
        format: 'json',
        mergeStrategy: 'skip_existing',
        validateData: true
      })

      const knowledge = await storage.load()
      expect(knowledge!.insights).toHaveLength(1) // Should still be 1, not 2
    })

    it('should reject invalid import data', async () => {
      const invalidData = JSON.stringify({
        knowledge: {
          insights: [{ invalid: 'data' }]
        }
      })

      const exportFile = join(testDataDir, 'invalid.json')
      require('fs').writeFileSync(exportFile, invalidData)
      
      await expect(exporter.importKnowledge(exportFile, {
        format: 'json',
        mergeStrategy: 'replace',
        validateData: true
      })).rejects.toThrow('Invalid import data format')
    })
  })
})