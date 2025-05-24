/**
 * Session manager for interactive knowledge mining
 */

import { randomUUID } from 'crypto'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { CodeExplorer } from './explorer.js'
import { QuestionGenerator } from '../agents/question-generator.js'
import { AnswerProcessor } from '../agents/answer-processor.js'
import { InteractiveSession } from '../cli/interactive.js'
import { OutputFormatter } from '../utils/formatting.js'
import { SQLiteKnowledgeStorage } from './knowledge-storage.js'
import { KnowledgeSynthesizer } from './knowledge-synthesis.js'
import { KnowledgeSearchEngine } from './knowledge-search.js'
import { AIProvider } from './ai.js'
import { GamificationEngine } from './gamification.js'
import { ConsoleProgressVisualizer } from '../utils/progress-visualizer.js'
import {
  SessionContext,
  UserPreferences,
  KnowledgeProgress,
  CodeArea,
  QuestionTarget,
  ResolvedYlog2Config
} from '../types/index.js'
import {
  Question,
  UserResponse,
  ProcessedAnswer
} from '../types/questions.js'
import {
  KnowledgeBase,
  SynthesisResult
} from '../types/knowledge.js'
import {
  SessionStats,
  SessionRewards,
  UserProgress
} from '../types/gamification.js'

export class SessionManager {
  private config: ResolvedYlog2Config
  private explorer: CodeExplorer
  private questionGenerator: QuestionGenerator
  private answerProcessor: AnswerProcessor
  private formatter: OutputFormatter
  private knowledgeStorage: SQLiteKnowledgeStorage
  private knowledgeSynthesizer: KnowledgeSynthesizer
  private knowledgeSearch: KnowledgeSearchEngine
  private aiProvider: AIProvider
  private gamificationEngine: GamificationEngine
  private progressVisualizer: ConsoleProgressVisualizer
  private sessionData: Map<string, any> = new Map()
  private sessionResponses: Array<{
    questionId: string
    answerId: string
    question: string
    answer: string
    insights: string[]
    timestamp: Date
  }> = []
  private sessionStartTime: Date = new Date()
  private sessionStats: SessionStats = {
    questionsAnswered: 0,
    areasExplored: 0,
    insightsGenerated: 0,
    averageConfidence: 0,
    timeSpent: 0,
    streakDay: 1,
    xpEarned: 0,
    achievementsUnlocked: 0
  }

  constructor(config: ResolvedYlog2Config) {
    this.config = config
    this.explorer = new CodeExplorer(config)
    this.questionGenerator = new QuestionGenerator(config)
    this.answerProcessor = new AnswerProcessor(config)
    this.formatter = new OutputFormatter()
    
    // Initialize knowledge system
    this.aiProvider = new AIProvider(config)
    this.knowledgeStorage = new SQLiteKnowledgeStorage(
      join(config.outputDir, 'knowledge', 'knowledge.db')
    )
    this.knowledgeSynthesizer = new KnowledgeSynthesizer(this.aiProvider)
    this.knowledgeSearch = new KnowledgeSearchEngine(this.knowledgeStorage, this.aiProvider)
    
    // Initialize gamification system
    this.gamificationEngine = new GamificationEngine(config.outputDir)
    this.progressVisualizer = new ConsoleProgressVisualizer()
    
    // Ensure data directory exists
    this.ensureDataDirectory()
    this.initializeKnowledgeSystem()
  }

  private async initializeKnowledgeSystem(): Promise<void> {
    try {
      await this.knowledgeStorage.initialize()
      await this.knowledgeSearch.initialize()
    } catch (error) {
      console.warn('Knowledge system initialization failed:', error)
    }
  }

  /**
   * Create a new interactive session
   */
  async createSession(preferences?: Partial<UserPreferences>): Promise<SessionContext> {
    const sessionId = this.generateSessionId()
    const startTime = new Date()
    
    // Set up user preferences
    const userPreferences: UserPreferences = {
      sessionLength: preferences?.sessionLength || this.config.session.defaultLength,
      questionTypes: preferences?.questionTypes || this.config.questions.questionTypes,
      focusAreas: preferences?.focusAreas || [],
      skipPatterns: preferences?.skipPatterns || []
    }
    
    // Initialize knowledge progress
    const knowledgeProgress: KnowledgeProgress = {
      totalAreas: 0,
      areasWithContext: 0,
      questionsAnswered: 0,
      insightsGenerated: 0,
      coveragePercentage: 0
    }
    
    const context: SessionContext = {
      sessionId,
      startTime,
      questionsAnswered: 0,
      areasExplored: [],
      userPreferences,
      knowledgeProgress
    }
    
    // Save initial session state
    await this.saveSession(context)
    
    return context
  }

  /**
   * Run a complete interactive session
   */
  async runInteractiveSession(
    sessionContext?: SessionContext
  ): Promise<void> {
    let context = sessionContext
    this.sessionStartTime = new Date()
    
    // Load user progress and show welcome with gamification
    const userProgress = await this.gamificationEngine.loadUserProgress()
    
    // Create new session if none provided
    if (!context) {
      context = await this.createSession()
    }
    
    const interactive = new InteractiveSession(context)
    
    try {
      // Show welcome with progress
      interactive.showWelcome()
      this.progressVisualizer.showLevelProgress(userProgress)
      
      // Show daily challenge
      const dailyChallenge = await this.gamificationEngine.generateDailyChallenge()
      this.progressVisualizer.showDailyChallenge(dailyChallenge)
      
      // Show motivational message
      this.progressVisualizer.showMotivationalMessage(userProgress)
      
      if (!sessionContext) {
        // Get session preferences from user
        const sessionLength = await interactive.askSessionLength()
        context.userPreferences.sessionLength = sessionLength
        
        // Explore codebase first
        interactive.showLoading('Exploring your codebase')
        const areas = await this.explorer.exploreCodebase()
        interactive.clearLoading()
        
        if (areas.length === 0) {
          interactive.showError('No areas found to explore')
          return
        }
        
        context.knowledgeProgress.totalAreas = areas.length
        
        // Let user choose focus areas
        const topAreas = areas.slice(0, 15).map(a => a.path)
        const focusAreas = await interactive.askFocusAreas(topAreas)
        context.userPreferences.focusAreas = focusAreas
        
        interactive.showTips()
        await interactive.pause('Ready to start? Press Enter...')
      }
      
      // Main session loop
      await this.runSessionLoop(context, interactive)
      
      // Calculate session rewards
      this.sessionStats.timeSpent = Math.floor((Date.now() - this.sessionStartTime.getTime()) / 1000)
      this.sessionStats.averageConfidence = this.calculateAverageConfidence()
      
      const rewards = await this.gamificationEngine.calculateSessionRewards(this.sessionStats)
      
      // Show enhanced session summary with gamification
      this.progressVisualizer.showSessionSummary(this.sessionStats, rewards)
      
      // Show achievements unlocked
      for (const achievement of rewards.achievementsUnlocked) {
        this.progressVisualizer.showAchievementUnlocked(achievement)
      }
      
      // Show updated progress
      const updatedProgress = await this.gamificationEngine.loadUserProgress()
      this.progressVisualizer.showLevelProgress(updatedProgress)
      
      // Show knowledge milestones
      const milestones = this.gamificationEngine.getKnowledgeMilestones()
      this.progressVisualizer.showKnowledgeMilestones(milestones)
      
      interactive.showGoodbye()
      
    } catch (error) {
      if (error.message === 'USER_INTERRUPTED') {
        const action = await interactive.handleInterruption()
        
        switch (action) {
          case 'save':
            await this.saveSession(context)
            console.log('✅ Session saved. Resume with: ylog2 resume')
            break
          case 'discard':
            console.log('🗑️  Session discarded')
            break
          case 'continue':
            await this.runInteractiveSession(context)
            break
        }
      } else {
        interactive.showError(`Session failed: ${error.message}`)
      }
    }
  }

  /**
   * Main session loop - ask questions and process answers
   */
  private async runSessionLoop(
    context: SessionContext,
    interactive: InteractiveSession
  ): Promise<void> {
    const maxQuestions = this.getMaxQuestions(context.userPreferences.sessionLength)
    
    while (context.questionsAnswered < maxQuestions) {
      try {
        // Get question targets
        const targets = await this.getQuestionTargets(context)
        
        if (targets.length === 0) {
          interactive.showWarning('No more areas to explore')
          break
        }
        
        // Generate question
        interactive.showLoading('Generating question')
        const question = await this.questionGenerator.generateQuestion(targets[0])
        interactive.clearLoading()
        
        // Present question and get response
        const response = await interactive.presentQuestion(question)
        
        // Process answer in parallel with user interaction
        const [processedAnswer] = await Promise.all([
          this.answerProcessor.processResponse(response),
          this.updateSessionProgress(context, question, response)
        ])
        
        // Store response for knowledge synthesis
        this.sessionResponses.push({
          questionId: question.id,
          answerId: response.id,
          question: question.text,
          answer: response.answer,
          insights: processedAnswer.insights,
          timestamp: new Date()
        })
        
        // Perform knowledge synthesis every 3 questions
        if (context.questionsAnswered % 3 === 0) {
          await this.performKnowledgeSynthesis(context, interactive)
        }
        
        // Show impact and progress
        this.showProgressUpdate(interactive, context, processedAnswer)
        
        // Save progress
        await this.saveSession(context)
        
        // Check if user wants to continue (for quick sessions)
        if (context.userPreferences.sessionLength === 'quick' && 
            context.questionsAnswered >= 3) {
          const shouldContinue = await interactive.askToContinue()
          if (!shouldContinue) break
        }
        
      } catch (error) {
        if (error.message === 'USER_INTERRUPTED') {
          throw error
        }
        interactive.showError(`Question failed: ${error.message}`)
        // Continue with next question
      }
    }
  }

  /**
   * Get question targets based on session context
   */
  private async getQuestionTargets(context: SessionContext): Promise<QuestionTarget[]> {
    // Explore areas if we haven't yet
    const areas = await this.explorer.exploreCodebase()
    
    // Filter areas based on user preferences
    let filteredAreas = areas
    
    if (context.userPreferences.focusAreas.length > 0) {
      filteredAreas = areas.filter(area => 
        context.userPreferences.focusAreas.some(focus => 
          area.path.includes(focus)
        )
      )
    }
    
    // Exclude areas we've already explored extensively
    filteredAreas = filteredAreas.filter(area => 
      !context.areasExplored.includes(area.path)
    )
    
    if (filteredAreas.length === 0) {
      // If we've exhausted focus areas, explore others
      filteredAreas = areas.filter(area => 
        !context.areasExplored.includes(area.path)
      )
    }
    
    // Analyze top areas and get question targets
    const topAreas = filteredAreas.slice(0, 5)
    const allTargets: QuestionTarget[] = []
    
    for (const area of topAreas) {
      try {
        const analysis = await this.explorer.analyzeArea(area)
        const targets = await this.explorer.identifyQuestionableCode(analysis)
        allTargets.push(...targets)
      } catch (error) {
        console.warn(`Failed to analyze area ${area.path}: ${error}`)
      }
    }
    
    // Sort by priority and return top targets
    return allTargets
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 10)
  }

  /**
   * Perform knowledge synthesis from recent Q&A responses
   */
  private async performKnowledgeSynthesis(
    context: SessionContext,
    interactive: InteractiveSession
  ): Promise<void> {
    if (this.sessionResponses.length === 0) return

    try {
      interactive.showLoading('Synthesizing knowledge from your responses')
      
      // Get existing knowledge for context
      const existingKnowledge = await this.knowledgeStorage.load()
      const existingInsights = existingKnowledge?.insights || []
      
      // Perform synthesis
      const synthesisResult = await this.knowledgeSynthesizer.synthesizeFromSession(
        context.sessionId,
        this.sessionResponses,
        {
          files: context.areasExplored,
          functions: [], // Could extract from responses
          changes: []
        },
        existingInsights
      )
      
      // Store new knowledge
      await this.storeKnowledgeSynthesis(synthesisResult)
      
      // Update knowledge progress
      context.knowledgeProgress.insightsGenerated += synthesisResult.newInsights.length
      
      interactive.clearLoading()
      
      // Show synthesis results to user
      if (synthesisResult.newInsights.length > 0 || synthesisResult.newDecisions.length > 0) {
        interactive.showKnowledgeSynthesis(synthesisResult)
      }
      
      // Refresh search index
      await this.knowledgeSearch.refresh()
      
    } catch (error) {
      interactive.clearLoading()
      console.warn('Knowledge synthesis failed:', error)
    }
  }

  /**
   * Store synthesis results in knowledge base
   */
  private async storeKnowledgeSynthesis(result: SynthesisResult): Promise<void> {
    try {
      // Store insights
      for (const insight of result.newInsights) {
        await this.knowledgeStorage.addInsight(insight)
      }
      
      // Store decisions
      for (const decision of result.newDecisions) {
        await this.knowledgeStorage.addDecision(decision)
      }
      
      // Store business context
      for (const context of result.newContext) {
        await this.knowledgeStorage.addContext(context)
      }
      
    } catch (error) {
      console.warn('Failed to store knowledge synthesis:', error)
    }
  }

  /**
   * Update session progress after answering a question
   */
  private async updateSessionProgress(
    context: SessionContext,
    question: Question,
    response: UserResponse
  ): Promise<void> {
    context.questionsAnswered++
    
    // Add area to explored list
    const areaPath = question.target.area.path
    const isNewArea = !context.areasExplored.includes(areaPath)
    if (isNewArea) {
      context.areasExplored.push(areaPath)
    }
    
    context.currentArea = question.target.area
    
    // Update knowledge progress
    context.knowledgeProgress.questionsAnswered = context.questionsAnswered
    context.knowledgeProgress.areasWithContext = context.areasExplored.length
    
    // Calculate coverage percentage
    if (context.knowledgeProgress.totalAreas > 0) {
      context.knowledgeProgress.coveragePercentage = 
        (context.areasExplored.length / context.knowledgeProgress.totalAreas) * 100
    }
    
    // Update session stats for gamification
    this.sessionStats.questionsAnswered++
    if (isNewArea) {
      this.sessionStats.areasExplored++
    }
  }

  private calculateAverageConfidence(): number {
    if (this.sessionResponses.length === 0) return 0
    
    // This would normally come from processed answers
    // For now, simulate based on response quality
    const confidenceSum = this.sessionResponses.reduce((sum, response) => {
      // Simple heuristic: longer, more detailed responses get higher confidence
      const responseLength = response.answer.length
      const confidence = Math.min(0.5 + (responseLength / 200), 1.0)
      return sum + confidence
    }, 0)
    
    return confidenceSum / this.sessionResponses.length
  }

  /**
   * Show progress update to user
   */
  private showProgressUpdate(
    interactive: InteractiveSession,
    context: SessionContext,
    answer: ProcessedAnswer
  ): void {
    // Show impact
    const area = context.currentArea?.path || 'Unknown'
    const improvement = Math.min(Math.floor(answer.confidence * 50), 25)
    interactive.showImpact(area, improvement)
    
    // Show celebration for milestones
    if (context.questionsAnswered === 5) {
      interactive.showCelebration('First 5 questions completed! 🎉')
    } else if (context.questionsAnswered === 10) {
      interactive.showCelebration('10 questions milestone! You\'re building great knowledge! 🚀')
    } else if (context.questionsAnswered % 10 === 0) {
      interactive.showCelebration(`${context.questionsAnswered} questions! Amazing dedication! ⭐`)
    }
    
    // Show progress periodically
    if (context.questionsAnswered % 3 === 0) {
      interactive.showKnowledgeProgress(context.knowledgeProgress)
    }
  }

  /**
   * Save session state
   */
  async saveSession(context: SessionContext): Promise<void> {
    const sessionFile = join(this.config.outputDir, 'sessions', `${context.sessionId}.json`)
    
    try {
      writeFileSync(sessionFile, JSON.stringify(context, null, 2))
    } catch (error) {
      console.warn(`Failed to save session: ${error}`)
    }
  }

  /**
   * Load session state
   */
  async loadSession(sessionId: string): Promise<SessionContext | null> {
    const sessionFile = join(this.config.outputDir, 'sessions', `${sessionId}.json`)
    
    if (!existsSync(sessionFile)) {
      return null
    }
    
    try {
      const content = readFileSync(sessionFile, 'utf-8')
      const context = JSON.parse(content)
      
      // Convert date strings back to Date objects
      context.startTime = new Date(context.startTime)
      
      return context
    } catch (error) {
      console.warn(`Failed to load session: ${error}`)
      return null
    }
  }

  /**
   * Resume an existing session
   */
  async resumeSession(sessionId: string): Promise<void> {
    const context = await this.loadSession(sessionId)
    
    if (!context) {
      throw new Error(`Session ${sessionId} not found`)
    }
    
    console.log(`🔄 Resuming session ${sessionId}...`)
    console.log(`📊 Progress: ${context.questionsAnswered} questions, ${context.areasExplored.length} areas`)
    console.log()
    
    await this.runInteractiveSession(context)
  }

  /**
   * Get max questions based on session length
   */
  private getMaxQuestions(sessionLength: 'quick' | 'medium' | 'deep'): number {
    switch (sessionLength) {
      case 'quick': return 5
      case 'medium': return 10
      case 'deep': return 25
      default: return 10
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 8)
    return `sess_${timestamp}_${random}`
  }

  /**
   * Ensure data directory structure exists
   */
  private ensureDataDirectory(): void {
    const dirs = [
      this.config.outputDir,
      join(this.config.outputDir, 'sessions'),
      join(this.config.outputDir, 'knowledge'),
      join(this.config.outputDir, 'cache')
    ]
    
    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
    }
  }

  /**
   * Search knowledge base
   */
  async searchKnowledge(
    query: string,
    options?: {
      type?: ('insight' | 'decision' | 'context')[]
      area?: string
      limit?: number
    }
  ) {
    try {
      return await this.knowledgeSearch.search(query, {
        type: options?.type || ['insight', 'decision', 'context'],
        area: options?.area,
        limit: options?.limit || 10,
        semantic: true
      })
    } catch (error) {
      console.warn('Knowledge search failed:', error)
      return []
    }
  }

  /**
   * Get knowledge recommendations based on current context
   */
  async getKnowledgeRecommendations(area?: string) {
    try {
      const recentQuestions = this.sessionResponses
        .slice(-5)
        .map(r => r.question)
      
      return await this.knowledgeSearch.getRecommendations(area, recentQuestions)
    } catch (error) {
      console.warn('Failed to get knowledge recommendations:', error)
      return {
        insights: [],
        decisions: [],
        patterns: [],
        suggestions: []
      }
    }
  }

  /**
   * Get knowledge metrics
   */
  async getKnowledgeMetrics() {
    try {
      return await this.knowledgeStorage.getMetrics()
    } catch (error) {
      console.warn('Failed to get knowledge metrics:', error)
      return {
        totalQuestions: 0,
        totalInsights: 0,
        totalDecisions: 0,
        averageConfidence: 0,
        coverageByArea: new Map(),
        activityByDay: new Map(),
        topContributors: []
      }
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.knowledgeStorage.cleanup()
    } catch (error) {
      console.warn('Failed to cleanup knowledge storage:', error)
    }
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    totalSessions: number
    totalQuestions: number
    averageSessionLength: number
  } {
    // TODO: Implement actual stats tracking
    return {
      totalSessions: 0,
      totalQuestions: 0,
      averageSessionLength: 0
    }
  }
}