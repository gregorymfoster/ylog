import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, rmSync, mkdirSync } from 'fs'
import { join } from 'path'
import { SQLiteKnowledgeStorage } from './knowledge-storage.js'
import { 
  KnowledgeInsight, 
  ArchitecturalDecision, 
  BusinessContext,
  KnowledgeSearch 
} from '../types/knowledge.js'

describe('SQLiteKnowledgeStorage', () => {
  const testDataDir = join(__dirname, '../../test-data')
  const testDbPath = join(testDataDir, 'test-knowledge.db')
  let storage: SQLiteKnowledgeStorage

  beforeEach(async () => {
    // Clean up test directory
    if (existsSync(testDataDir)) {
      rmSync(testDataDir, { recursive: true, force: true })
    }
    mkdirSync(testDataDir, { recursive: true })
    
    storage = new SQLiteKnowledgeStorage(testDbPath)
    await storage.initialize()
  })

  afterEach(async () => {
    await storage.cleanup()
    
    // Clean up test directory
    if (existsSync(testDataDir)) {
      rmSync(testDataDir, { recursive: true, force: true })
    }
  })

  describe('Insights', () => {
    const sampleInsight: KnowledgeInsight = {
      id: 'insight-1',
      topic: 'Authentication Strategy',
      insight: 'We use JWT tokens for stateless authentication to improve scalability',
      confidence: 0.9,
      sources: ['question-1', 'question-2'],
      area: 'src/auth',
      category: 'technical',
      impact: 'high',
      created: new Date('2024-01-01')
    }

    it('should add and retrieve insights', async () => {
      await storage.addInsight(sampleInsight)
      
      const knowledge = await storage.load()
      expect(knowledge).toBeTruthy()
      expect(knowledge!.insights).toHaveLength(1)
      
      const savedInsight = knowledge!.insights[0]
      expect(savedInsight.id).toBe(sampleInsight.id)
      expect(savedInsight.topic).toBe(sampleInsight.topic)
      expect(savedInsight.insight).toBe(sampleInsight.insight)
      expect(savedInsight.confidence).toBe(sampleInsight.confidence)
      expect(savedInsight.area).toBe(sampleInsight.area)
      expect(savedInsight.category).toBe(sampleInsight.category)
    })

    it('should update existing insights', async () => {
      await storage.addInsight(sampleInsight)
      
      const updatedInsight = {
        ...sampleInsight,
        insight: 'Updated insight content',
        confidence: 0.95
      }
      
      await storage.addInsight(updatedInsight)
      
      const knowledge = await storage.load()
      expect(knowledge!.insights).toHaveLength(1)
      
      const savedInsight = knowledge!.insights[0]
      expect(savedInsight.insight).toBe('Updated insight content')
      expect(savedInsight.confidence).toBe(0.95)
    })
  })

  describe('Architectural Decisions', () => {
    const sampleDecision: ArchitecturalDecision = {
      id: 'decision-1',
      decision: 'Use React for frontend framework',
      rationale: 'React provides excellent component reusability and has strong community support',
      alternatives: ['Vue.js', 'Angular', 'Svelte'],
      tradeoffs: 'Steeper learning curve but better long-term maintainability',
      context: 'Building a complex web application with multiple team members',
      area: 'frontend',
      confidence: 0.85,
      sources: ['question-3'],
      created: new Date('2024-01-02')
    }

    it('should add and retrieve decisions', async () => {
      await storage.addDecision(sampleDecision)
      
      const knowledge = await storage.load()
      expect(knowledge!.decisions).toHaveLength(1)
      
      const savedDecision = knowledge!.decisions[0]
      expect(savedDecision.id).toBe(sampleDecision.id)
      expect(savedDecision.decision).toBe(sampleDecision.decision)
      expect(savedDecision.rationale).toBe(sampleDecision.rationale)
      expect(savedDecision.alternatives).toEqual(sampleDecision.alternatives)
    })
  })

  describe('Business Context', () => {
    const sampleContext: BusinessContext = {
      id: 'context-1',
      requirement: 'Support user registration with email verification',
      implementation: 'Implemented email verification using SendGrid API',
      impact: 'Reduces spam accounts and improves user quality',
      stakeholder: 'Product Manager',
      priority: 'high',
      area: 'user-management',
      sources: ['question-4'],
      created: new Date('2024-01-03')
    }

    it('should add and retrieve business context', async () => {
      await storage.addContext(sampleContext)
      
      const knowledge = await storage.load()
      expect(knowledge!.businessContext).toHaveLength(1)
      
      const savedContext = knowledge!.businessContext[0]
      expect(savedContext.id).toBe(sampleContext.id)
      expect(savedContext.requirement).toBe(sampleContext.requirement)
      expect(savedContext.implementation).toBe(sampleContext.implementation)
      expect(savedContext.stakeholder).toBe(sampleContext.stakeholder)
    })
  })

  describe('Search', () => {
    beforeEach(async () => {
      // Add sample data for search tests
      await storage.addInsight({
        id: 'insight-1',
        topic: 'Database Connection',
        insight: 'We use connection pooling to optimize database performance',
        confidence: 0.9,
        sources: ['q1'],
        area: 'database',
        category: 'technical',
        impact: 'high',
        created: new Date()
      })

      await storage.addInsight({
        id: 'insight-2',
        topic: 'API Rate Limiting',
        insight: 'Rate limiting is implemented using Redis for distributed systems',
        confidence: 0.8,
        sources: ['q2'],
        area: 'api',
        category: 'technical',
        impact: 'medium',
        created: new Date()
      })

      await storage.addDecision({
        id: 'decision-1',
        decision: 'Use PostgreSQL for primary database',
        rationale: 'PostgreSQL provides excellent ACID compliance and JSON support',
        alternatives: ['MySQL', 'MongoDB'],
        tradeoffs: 'More complex setup but better data integrity',
        context: 'Need reliable database for financial data',
        area: 'database',
        confidence: 0.95,
        sources: ['q3'],
        created: new Date()
      })
    })

    it('should search insights by keyword', async () => {
      const query: KnowledgeSearch = {
        query: 'database',
        results: [],
        totalResults: 0
      }

      const results = await storage.search(query)
      
      expect(results.length).toBeGreaterThan(0)
      
      const databaseResults = results.filter(r => 
        r.content.toLowerCase().includes('database') ||
        r.area.toLowerCase().includes('database')
      )
      expect(databaseResults.length).toBeGreaterThan(0)
    })

    it('should search decisions by rationale', async () => {
      const query: KnowledgeSearch = {
        query: 'PostgreSQL',
        results: [],
        totalResults: 0
      }

      const results = await storage.search(query)
      
      expect(results.length).toBeGreaterThan(0)
      
      const postgresResult = results.find(r => r.content.includes('PostgreSQL'))
      expect(postgresResult).toBeTruthy()
      expect(postgresResult!.type).toBe('decision')
    })

    it('should return empty results for non-existent terms', async () => {
      const query: KnowledgeSearch = {
        query: 'nonexistentterm12345',
        results: [],
        totalResults: 0
      }

      const results = await storage.search(query)
      expect(results).toHaveLength(0)
    })
  })

  describe('Metrics', () => {
    beforeEach(async () => {
      // Add sample data for metrics tests
      await storage.addInsight({
        id: 'insight-1',
        topic: 'Test Insight 1',
        insight: 'Test content',
        confidence: 0.8,
        sources: ['q1'],
        area: 'frontend',
        category: 'technical',
        impact: 'high',
        created: new Date()
      })

      await storage.addInsight({
        id: 'insight-2',
        topic: 'Test Insight 2',
        insight: 'Test content',
        confidence: 0.9,
        sources: ['q2'],
        area: 'backend',
        category: 'technical',
        impact: 'medium',
        created: new Date()
      })

      await storage.addDecision({
        id: 'decision-1',
        decision: 'Test Decision',
        rationale: 'Test rationale',
        alternatives: [],
        tradeoffs: 'Test tradeoffs',
        context: 'Test context',
        area: 'backend',
        confidence: 0.85,
        sources: ['q3'],
        created: new Date()
      })
    })

    it('should calculate correct metrics', async () => {
      const metrics = await storage.getMetrics()
      
      expect(metrics.totalInsights).toBe(2)
      expect(metrics.totalDecisions).toBe(1)
      expect(metrics.averageConfidence).toBeCloseTo(0.85, 2) // (0.8 + 0.9) / 2
      
      expect(metrics.coverageByArea.get('frontend')).toBe(1)
      expect(metrics.coverageByArea.get('backend')).toBe(2) // 1 insight + 1 decision
    })
  })

  describe('Data Persistence', () => {
    it('should persist data across storage instances', async () => {
      const insight: KnowledgeInsight = {
        id: 'persist-test',
        topic: 'Persistence Test',
        insight: 'This should persist',
        confidence: 0.7,
        sources: ['q1'],
        area: 'test',
        category: 'technical',
        impact: 'low',
        created: new Date()
      }

      await storage.addInsight(insight)
      await storage.cleanup()

      // Create new storage instance
      const newStorage = new SQLiteKnowledgeStorage(testDbPath)
      await newStorage.initialize()
      
      const knowledge = await newStorage.load()
      expect(knowledge!.insights).toHaveLength(1)
      expect(knowledge!.insights[0].id).toBe('persist-test')
      
      await newStorage.cleanup()
    })
  })
})