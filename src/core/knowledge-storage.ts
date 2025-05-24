import { Database } from 'sqlite3'
import { promises as fs } from 'fs'
import path from 'path'
import {
  KnowledgeBase,
  KnowledgeStorage,
  KnowledgeInsight,
  ArchitecturalDecision,
  BusinessContext,
  KnowledgeSearch,
  KnowledgeSearchResult,
  KnowledgeMetrics,
  KnowledgeCluster,
  KnowledgePattern,
  AreaKnowledge
} from '../types/knowledge.js'

export class SQLiteKnowledgeStorage implements KnowledgeStorage {
  private db: Database | null = null
  private dbPath: string

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), '.ylog2', 'knowledge.db')
  }

  async initialize(): Promise<void> {
    const dbDir = path.dirname(this.dbPath)
    await fs.mkdir(dbDir, { recursive: true })

    return new Promise((resolve, reject) => {
      this.db = new Database(this.dbPath, (err) => {
        if (err) {
          reject(err)
          return
        }
        this.createTables().then(resolve).catch(reject)
      })
    })
  }

  private async createTables(): Promise<void> {
    const tables = [
      `CREATE TABLE IF NOT EXISTS insights (
        id TEXT PRIMARY KEY,
        topic TEXT NOT NULL,
        insight TEXT NOT NULL,
        confidence REAL NOT NULL,
        sources TEXT NOT NULL,
        area TEXT NOT NULL,
        category TEXT NOT NULL,
        impact TEXT NOT NULL,
        created TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        decision TEXT NOT NULL,
        rationale TEXT NOT NULL,
        alternatives TEXT NOT NULL,
        tradeoffs TEXT NOT NULL,
        context TEXT NOT NULL,
        area TEXT NOT NULL,
        confidence REAL NOT NULL,
        sources TEXT NOT NULL,
        created TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS business_context (
        id TEXT PRIMARY KEY,
        requirement TEXT NOT NULL,
        implementation TEXT NOT NULL,
        impact TEXT NOT NULL,
        stakeholder TEXT,
        priority TEXT NOT NULL,
        area TEXT NOT NULL,
        sources TEXT NOT NULL,
        created TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS patterns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        pattern TEXT NOT NULL,
        examples TEXT NOT NULL,
        confidence REAL NOT NULL,
        frequency INTEGER NOT NULL,
        related_items TEXT NOT NULL,
        created TEXT NOT NULL,
        updated TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS clusters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        items TEXT NOT NULL,
        patterns TEXT NOT NULL,
        insights TEXT NOT NULL,
        confidence REAL NOT NULL,
        created TEXT NOT NULL,
        updated TEXT NOT NULL,
        metadata TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS qa_history (
        id TEXT PRIMARY KEY,
        question_id TEXT NOT NULL,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        category TEXT NOT NULL,
        area TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        confidence REAL NOT NULL
      )`
    ]

    for (const table of tables) {
      await this.runQuery(table)
    }

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_insights_area ON insights(area)',
      'CREATE INDEX IF NOT EXISTS idx_insights_category ON insights(category)',
      'CREATE INDEX IF NOT EXISTS idx_decisions_area ON decisions(area)',
      'CREATE INDEX IF NOT EXISTS idx_context_area ON business_context(area)',
      'CREATE INDEX IF NOT EXISTS idx_qa_area ON qa_history(area)',
      'CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON patterns(confidence)',
      'CREATE INDEX IF NOT EXISTS idx_clusters_confidence ON clusters(confidence)'
    ]

    for (const index of indexes) {
      await this.runQuery(index)
    }
  }

  private runQuery(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(this)
        }
      })
    })
  }

  private allQuery(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err)
        } else {
          resolve(rows)
        }
      })
    })
  }

  async save(knowledge: KnowledgeBase): Promise<void> {
    if (!this.db) {
      await this.initialize()
    }

    await this.runQuery('BEGIN TRANSACTION')

    try {
      for (const [area, areaKnowledge] of knowledge.areas) {
        for (const insight of areaKnowledge.insights) {
          await this.addInsight(insight)
        }
        for (const decision of areaKnowledge.decisions) {
          await this.addDecision(decision)
        }
        for (const context of areaKnowledge.businessContext) {
          await this.addContext(context)
        }
        for (const qa of areaKnowledge.qaHistory) {
          await this.runQuery(
            `INSERT OR REPLACE INTO qa_history 
             (id, question_id, question, answer, category, area, timestamp, confidence)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              `${qa.questionId}-${Date.now()}`,
              qa.questionId,
              qa.question,
              qa.answer,
              qa.category,
              area,
              qa.timestamp.toISOString(),
              qa.confidence
            ]
          )
        }
      }

      await this.runQuery('COMMIT')
    } catch (error) {
      await this.runQuery('ROLLBACK')
      throw error
    }
  }

  async load(): Promise<KnowledgeBase | null> {
    if (!this.db) {
      await this.initialize()
    }

    try {
      const insights = await this.allQuery('SELECT * FROM insights')
      const decisions = await this.allQuery('SELECT * FROM decisions')
      const contexts = await this.allQuery('SELECT * FROM business_context')
      const qaHistory = await this.allQuery('SELECT * FROM qa_history')

      const areas = new Map<string, AreaKnowledge>()

      const allAreas = new Set([
        ...insights.map((i: any) => i.area),
        ...decisions.map((d: any) => d.area),
        ...contexts.map((c: any) => c.area),
        ...qaHistory.map((qa: any) => qa.area)
      ])

      for (const area of allAreas) {
        const areaInsights = insights
          .filter((i: any) => i.area === area)
          .map((i: any) => ({
            id: i.id,
            topic: i.topic,
            insight: i.insight,
            confidence: i.confidence,
            sources: JSON.parse(i.sources),
            area: i.area,
            category: i.category as any,
            impact: i.impact as any,
            created: new Date(i.created)
          }))

        const areaDecisions = decisions
          .filter((d: any) => d.area === area)
          .map((d: any) => ({
            id: d.id,
            decision: d.decision,
            rationale: d.rationale,
            alternatives: JSON.parse(d.alternatives),
            tradeoffs: d.tradeoffs,
            context: d.context,
            area: d.area,
            confidence: d.confidence,
            sources: JSON.parse(d.sources),
            created: new Date(d.created)
          }))

        const areaContexts = contexts
          .filter((c: any) => c.area === area)
          .map((c: any) => ({
            id: c.id,
            requirement: c.requirement,
            implementation: c.implementation,
            impact: c.impact,
            stakeholder: c.stakeholder,
            priority: c.priority as any,
            area: c.area,
            sources: JSON.parse(c.sources),
            created: new Date(c.created)
          }))

        const areaQA = qaHistory
          .filter((qa: any) => qa.area === area)
          .map((qa: any) => ({
            questionId: qa.question_id,
            question: qa.question,
            answer: qa.answer,
            category: qa.category as any,
            timestamp: new Date(qa.timestamp),
            confidence: qa.confidence
          }))

        areas.set(area, {
          area,
          coverage: Math.min(areaInsights.length * 0.1 + areaDecisions.length * 0.2, 1),
          lastUpdated: new Date(),
          insights: areaInsights,
          decisions: areaDecisions,
          businessContext: areaContexts,
          qaHistory: areaQA,
          synthesisConfidence: areaInsights.reduce((sum, i) => sum + i.confidence, 0) / Math.max(areaInsights.length, 1)
        })
      }

      return {
        areas,
        insights: insights.map((i: any) => ({
          id: i.id,
          topic: i.topic,
          insight: i.insight,
          confidence: i.confidence,
          sources: JSON.parse(i.sources),
          area: i.area,
          category: i.category as any,
          impact: i.impact as any,
          created: new Date(i.created)
        })),
        decisions: decisions.map((d: any) => ({
          id: d.id,
          decision: d.decision,
          rationale: d.rationale,
          alternatives: JSON.parse(d.alternatives),
          tradeoffs: d.tradeoffs,
          context: d.context,
          area: d.area,
          confidence: d.confidence,
          sources: JSON.parse(d.sources),
          created: new Date(d.created)
        })),
        businessContext: contexts.map((c: any) => ({
          id: c.id,
          requirement: c.requirement,
          implementation: c.implementation,
          impact: c.impact,
          stakeholder: c.stakeholder,
          priority: c.priority as any,
          area: c.area,
          sources: JSON.parse(c.sources),
          created: new Date(c.created)
        })),
        lastUpdated: new Date(),
        version: '1.0.0'
      }
    } catch (error) {
      console.warn('Failed to load knowledge base:', error)
      return null
    }
  }

  async addInsight(insight: KnowledgeInsight): Promise<void> {
    await this.runQuery(
      `INSERT OR REPLACE INTO insights 
       (id, topic, insight, confidence, sources, area, category, impact, created)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        insight.id,
        insight.topic,
        insight.insight,
        insight.confidence,
        JSON.stringify(insight.sources),
        insight.area,
        insight.category,
        insight.impact,
        insight.created.toISOString()
      ]
    )
  }

  async addDecision(decision: ArchitecturalDecision): Promise<void> {
    await this.runQuery(
      `INSERT OR REPLACE INTO decisions 
       (id, decision, rationale, alternatives, tradeoffs, context, area, confidence, sources, created)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        decision.id,
        decision.decision,
        decision.rationale,
        JSON.stringify(decision.alternatives),
        decision.tradeoffs,
        decision.context,
        decision.area,
        decision.confidence,
        JSON.stringify(decision.sources),
        decision.created.toISOString()
      ]
    )
  }

  async addContext(context: BusinessContext): Promise<void> {
    await this.runQuery(
      `INSERT OR REPLACE INTO business_context 
       (id, requirement, implementation, impact, stakeholder, priority, area, sources, created)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        context.id,
        context.requirement,
        context.implementation,
        context.impact,
        context.stakeholder || null,
        context.priority,
        context.area,
        JSON.stringify(context.sources),
        context.created.toISOString()
      ]
    )
  }

  async search(query: KnowledgeSearch): Promise<KnowledgeSearchResult[]> {
    const results: KnowledgeSearchResult[] = []
    const searchTerm = `%${query.query.toLowerCase()}%`

    const insightResults = await this.allQuery(
      `SELECT 'insight' as type, confidence as relevance, insight as content, area, id as source, 
              substr(insight, 1, 200) as snippet 
       FROM insights 
       WHERE lower(topic) LIKE ? OR lower(insight) LIKE ?
       ORDER BY confidence DESC
       LIMIT 10`,
      [searchTerm, searchTerm]
    )

    const decisionResults = await this.allQuery(
      `SELECT 'decision' as type, confidence as relevance, decision as content, area, id as source,
              substr(rationale, 1, 200) as snippet
       FROM decisions 
       WHERE lower(decision) LIKE ? OR lower(rationale) LIKE ? OR lower(context) LIKE ?
       ORDER BY confidence DESC
       LIMIT 10`,
      [searchTerm, searchTerm, searchTerm]
    )

    const contextResults = await this.allQuery(
      `SELECT 'context' as type, 0.8 as relevance, requirement as content, area, id as source,
              substr(implementation, 1, 200) as snippet
       FROM business_context 
       WHERE lower(requirement) LIKE ? OR lower(implementation) LIKE ? OR lower(impact) LIKE ?
       ORDER BY created DESC
       LIMIT 10`,
      [searchTerm, searchTerm, searchTerm]
    )

    const qaResults = await this.allQuery(
      `SELECT 'qa' as type, confidence as relevance, question as content, area, question_id as source,
              substr(answer, 1, 200) as snippet
       FROM qa_history 
       WHERE lower(question) LIKE ? OR lower(answer) LIKE ?
       ORDER BY confidence DESC
       LIMIT 10`,
      [searchTerm, searchTerm]
    )

    results.push(...insightResults, ...decisionResults, ...contextResults, ...qaResults)
    
    return results.sort((a, b) => b.relevance - a.relevance)
  }

  async getMetrics(): Promise<KnowledgeMetrics> {
    const [insightCount] = await this.allQuery('SELECT COUNT(*) as count FROM insights')
    const [decisionCount] = await this.allQuery('SELECT COUNT(*) as count FROM decisions')
    const [qaCount] = await this.allQuery('SELECT COUNT(*) as count FROM qa_history')
    const [avgConfidence] = await this.allQuery('SELECT AVG(confidence) as avg FROM insights')

    const areaStats = await this.allQuery(`
      SELECT area, COUNT(*) as count 
      FROM (
        SELECT area FROM insights
        UNION ALL
        SELECT area FROM decisions
        UNION ALL
        SELECT area FROM business_context
      ) 
      GROUP BY area
    `)

    const activityStats = await this.allQuery(`
      SELECT DATE(created) as date, COUNT(*) as count
      FROM (
        SELECT created FROM insights
        UNION ALL
        SELECT created FROM decisions
        UNION ALL
        SELECT created FROM business_context
      )
      WHERE created >= datetime('now', '-30 days')
      GROUP BY DATE(created)
      ORDER BY date
    `)

    return {
      totalQuestions: qaCount.count,
      totalInsights: insightCount.count,
      totalDecisions: decisionCount.count,
      averageConfidence: avgConfidence.avg || 0,
      coverageByArea: new Map(areaStats.map((stat: any) => [stat.area, stat.count])),
      activityByDay: new Map(activityStats.map((stat: any) => [stat.date, stat.count])),
      topContributors: []
    }
  }

  async cleanup(): Promise<void> {
    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        this.db!.close((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
      this.db = null
    }
  }
}