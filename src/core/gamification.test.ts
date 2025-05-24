import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, rmSync, mkdirSync } from 'fs'
import { join } from 'path'
import { GamificationEngine } from './gamification.js'
import { SessionStats } from '../types/gamification.js'

describe('GamificationEngine', () => {
  const testDataDir = join(__dirname, '../../test-data')
  let engine: GamificationEngine

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(testDataDir)) {
      rmSync(testDataDir, { recursive: true, force: true })
    }
    mkdirSync(testDataDir, { recursive: true })
    
    engine = new GamificationEngine(testDataDir)
  })

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDataDir)) {
      rmSync(testDataDir, { recursive: true, force: true })
    }
  })

  describe('User Progress', () => {
    it('should create new user progress on first load', async () => {
      const progress = await engine.loadUserProgress()
      
      expect(progress.level).toBe(1)
      expect(progress.xp).toBe(0)
      expect(progress.totalQuestions).toBe(0)
      expect(progress.achievements).toHaveLength(0)
      expect(progress.currentStreak).toBe(0)
    })

    it('should save and load user progress', async () => {
      const progress = await engine.loadUserProgress()
      progress.level = 5
      progress.xp = 500
      progress.totalQuestions = 25
      
      await engine.saveUserProgress()
      
      // Create new engine instance to test loading
      const newEngine = new GamificationEngine(testDataDir)
      const loadedProgress = await newEngine.loadUserProgress()
      
      expect(loadedProgress.level).toBe(5)
      expect(loadedProgress.xp).toBe(500)
      expect(loadedProgress.totalQuestions).toBe(25)
    })
  })

  describe('Session Rewards', () => {
    it('should calculate basic XP rewards', async () => {
      const sessionStats: SessionStats = {
        questionsAnswered: 5,
        areasExplored: 2,
        insightsGenerated: 3,
        averageConfidence: 0.7,
        timeSpent: 300,
        streakDay: 1,
        xpEarned: 0,
        achievementsUnlocked: 0
      }

      const rewards = await engine.calculateSessionRewards(sessionStats)
      
      expect(rewards.xpGained).toBe(50) // 5 questions * 10 XP each
      expect(rewards.achievementsUnlocked).toHaveLength(0)
    })

    it('should calculate quality bonus for high confidence', async () => {
      const sessionStats: SessionStats = {
        questionsAnswered: 4,
        areasExplored: 2,
        insightsGenerated: 2,
        averageConfidence: 0.85,
        timeSpent: 240,
        streakDay: 1,
        xpEarned: 0,
        achievementsUnlocked: 0
      }

      const rewards = await engine.calculateSessionRewards(sessionStats)
      
      expect(rewards.xpGained).toBe(60) // 40 base + 20 quality bonus (50%)
      expect(rewards.qualityBonus).toBe(20)
    })

    it('should unlock first question achievement', async () => {
      const sessionStats: SessionStats = {
        questionsAnswered: 1,
        areasExplored: 1,
        insightsGenerated: 1,
        averageConfidence: 0.8,
        timeSpent: 60,
        streakDay: 1,
        xpEarned: 0,
        achievementsUnlocked: 0
      }

      const rewards = await engine.calculateSessionRewards(sessionStats)
      
      expect(rewards.achievementsUnlocked).toHaveLength(1)
      expect(rewards.achievementsUnlocked[0].id).toBe('first_question')
      expect(rewards.achievementsUnlocked[0].name).toBe('Knowledge Seeker')
    })

    it('should handle level up correctly', async () => {
      // Load progress and set it close to level up
      const progress = await engine.loadUserProgress()
      progress.xp = 95
      progress.xpToNextLevel = 100
      await engine.saveUserProgress()

      const sessionStats: SessionStats = {
        questionsAnswered: 1,
        areasExplored: 1,
        insightsGenerated: 1,
        averageConfidence: 0.7,
        timeSpent: 60,
        streakDay: 1,
        xpEarned: 0,
        achievementsUnlocked: 0
      }

      const rewards = await engine.calculateSessionRewards(sessionStats)
      
      expect(rewards.levelUp).toBeDefined()
      expect(rewards.levelUp?.newLevel).toBe(2)
      expect(rewards.levelUp?.previousLevel).toBe(1)
    })
  })

  describe('Achievements', () => {
    it('should unlock milestone achievements', async () => {
      // Simulate progress for 10 questions achievement
      const progress = await engine.loadUserProgress()
      progress.totalQuestions = 9 // One shy of achievement
      await engine.saveUserProgress()

      const sessionStats: SessionStats = {
        questionsAnswered: 1,
        areasExplored: 1,
        insightsGenerated: 1,
        averageConfidence: 0.7,
        timeSpent: 60,
        streakDay: 1,
        xpEarned: 0,
        achievementsUnlocked: 0
      }

      const rewards = await engine.calculateSessionRewards(sessionStats)
      
      const questionMasterAchievement = rewards.achievementsUnlocked.find(a => a.id === 'question_master_10')
      expect(questionMasterAchievement).toBeDefined()
      expect(questionMasterAchievement?.name).toBe('Question Master')
    })

    it('should not unlock the same achievement twice', async () => {
      // First unlock
      const sessionStats: SessionStats = {
        questionsAnswered: 1,
        areasExplored: 1,
        insightsGenerated: 1,
        averageConfidence: 0.7,
        timeSpent: 60,
        streakDay: 1,
        xpEarned: 0,
        achievementsUnlocked: 0
      }

      const firstRewards = await engine.calculateSessionRewards(sessionStats)
      expect(firstRewards.achievementsUnlocked).toHaveLength(1)

      // Second session - should not unlock again
      const secondRewards = await engine.calculateSessionRewards(sessionStats)
      expect(secondRewards.achievementsUnlocked).toHaveLength(0)
    })
  })

  describe('Daily Challenge', () => {
    it('should generate valid daily challenge', async () => {
      const challenge = await engine.generateDailyChallenge()
      
      expect(challenge.id).toMatch(/^daily_\d{4}-\d{2}-\d{2}$/)
      expect(challenge.title).toBeTruthy()
      expect(challenge.description).toBeTruthy()
      expect(challenge.target).toBeGreaterThan(0)
      expect(challenge.reward.xp).toBeGreaterThan(0)
      expect(challenge.progress).toBe(0)
      expect(challenge.completed).toBe(false)
    })

    it('should have consistent challenge ID for same day', async () => {
      const challenge1 = await engine.generateDailyChallenge()
      const challenge2 = await engine.generateDailyChallenge()
      
      expect(challenge1.id).toBe(challenge2.id)
    })
  })

  describe('Knowledge Milestones', () => {
    it('should track insight milestones', async () => {
      const progress = await engine.loadUserProgress()
      progress.totalInsights = 15
      await engine.saveUserProgress()

      const milestones = engine.getKnowledgeMilestones()
      
      const firstMilestone = milestones.find(m => m.id === 'insights_10')
      const secondMilestone = milestones.find(m => m.id === 'insights_25')
      
      expect(firstMilestone?.achieved).toBe(true)
      expect(secondMilestone?.achieved).toBe(false)
      expect(firstMilestone?.nextMilestone?.id).toBe('insights_25')
    })

    it('should track confidence milestones', async () => {
      const progress = await engine.loadUserProgress()
      progress.averageConfidence = 0.85
      await engine.saveUserProgress()

      const milestones = engine.getKnowledgeMilestones()
      
      const confidenceMilestone = milestones.find(m => m.id === 'confidence_80')
      expect(confidenceMilestone?.achieved).toBe(true)
    })
  })

  describe('Streak Tracking', () => {
    it('should maintain streak on consecutive days', async () => {
      // First day
      const sessionStats: SessionStats = {
        questionsAnswered: 1,
        areasExplored: 1,
        insightsGenerated: 1,
        averageConfidence: 0.7,
        timeSpent: 60,
        streakDay: 1,
        xpEarned: 0,
        achievementsUnlocked: 0
      }

      await engine.calculateSessionRewards(sessionStats)
      
      let progress = await engine.loadUserProgress()
      expect(progress.currentStreak).toBe(1)

      // Simulate next day by manually setting date
      progress.lastActiveDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
      await engine.saveUserProgress()

      // Second day
      await engine.calculateSessionRewards(sessionStats)
      
      progress = await engine.loadUserProgress()
      expect(progress.currentStreak).toBe(2)
    })
  })
})