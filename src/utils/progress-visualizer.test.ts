import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ConsoleProgressVisualizer } from './progress-visualizer.js'
import { 
  UserProgress, 
  SessionStats, 
  SessionRewards,
  Achievement,
  DailyChallenge,
  KnowledgeMilestone
} from '../types/gamification.js'

// Mock console methods
const mockConsoleLog = vi.fn()
vi.stubGlobal('console', { log: mockConsoleLog })

describe('ConsoleProgressVisualizer', () => {
  let visualizer: ConsoleProgressVisualizer

  beforeEach(() => {
    visualizer = new ConsoleProgressVisualizer()
    mockConsoleLog.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const sampleUserProgress: UserProgress = {
    userId: 'user-1',
    level: 5,
    xp: 350,
    xpToNextLevel: 500,
    totalQuestions: 25,
    totalAreas: 8,
    totalInsights: 12,
    currentStreak: 3,
    longestStreak: 7,
    averageConfidence: 0.85,
    sessionsCompleted: 6,
    achievements: [
      {
        id: 'first_question',
        name: 'Knowledge Seeker',
        description: 'Answer your first question',
        icon: '🌱',
        type: 'milestone',
        requirement: { type: 'questions_answered', value: 1 },
        reward: { xp: 10 },
        rarity: 'common',
        unlockedAt: new Date('2024-01-01')
      }
    ],
    lastActiveDate: new Date(),
    joinDate: new Date('2024-01-01'),
    stats: {
      questionsToday: 3,
      questionsThisWeek: 15,
      insightsThisWeek: 8,
      areasExploredThisWeek: 5
    }
  }

  const sampleSessionStats: SessionStats = {
    questionsAnswered: 5,
    areasExplored: 2,
    insightsGenerated: 3,
    averageConfidence: 0.8,
    timeSpent: 300,
    streakDay: 3,
    xpEarned: 75,
    achievementsUnlocked: 1
  }

  const sampleSessionRewards: SessionRewards = {
    xpGained: 75,
    achievementsUnlocked: [
      {
        id: 'question_master_10',
        name: 'Question Master',
        description: 'Answer 10 questions',
        icon: '🎯',
        type: 'milestone',
        requirement: { type: 'questions_answered', value: 10 },
        reward: { xp: 50, badge: 'question_master' },
        rarity: 'uncommon',
        unlockedAt: new Date()
      }
    ],
    levelUp: {
      newLevel: 6,
      previousLevel: 5
    },
    qualityBonus: 25,
    streakBonus: 15
  }

  describe('showLevelProgress', () => {
    it('should display level progress information', () => {
      visualizer.showLevelProgress(sampleUserProgress)

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Level 5')
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('350 / 500 XP')
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('🔥 3 day streak!')
      )
    })

    it('should show progress bar', () => {
      visualizer.showLevelProgress(sampleUserProgress)

      const progressBarCall = mockConsoleLog.mock.calls.find(call => 
        call[0] && typeof call[0] === 'string' && call[0].includes('[')
      )
      expect(progressBarCall).toBeTruthy()
    })

    it('should show level badge for high level user', () => {
      const highLevelProgress = {
        ...sampleUserProgress,
        level: 25
      }

      visualizer.showLevelProgress(highLevelProgress)

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('🏆 Master')
      )
    })
  })

  describe('showAchievementUnlocked', () => {
    const achievement: Achievement = {
      id: 'test_achievement',
      name: 'Test Achievement',
      description: 'This is a test achievement',
      icon: '🏆',
      type: 'milestone',
      requirement: { type: 'questions_answered', value: 5 },
      reward: { xp: 100, badge: 'test_badge' },
      rarity: 'rare',
      unlockedAt: new Date()
    }

    it('should display achievement unlock celebration', () => {
      visualizer.showAchievementUnlocked(achievement)

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('ACHIEVEMENT UNLOCKED!')
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('🏆 Test Achievement')
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('This is a test achievement')
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('+100 XP')
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Badge: test_badge')
      )
    })

    it('should use correct rarity colors', () => {
      const legendaryAchievement = { ...achievement, rarity: 'legendary' as const }
      
      visualizer.showAchievementUnlocked(legendaryAchievement)

      // Check that console.log was called with colored text (chalk functions)
      const coloredCalls = mockConsoleLog.mock.calls.filter(call => 
        call[0] && typeof call[0] === 'object' // Chalk returns objects
      )
      expect(coloredCalls.length).toBeGreaterThan(0)
    })
  })

  describe('showSessionSummary', () => {
    it('should display comprehensive session summary', () => {
      visualizer.showSessionSummary(sampleSessionStats, sampleSessionRewards)

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('SESSION COMPLETE!')
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Questions answered: 5')
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Areas explored: 2')
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Average confidence: 80.0%')
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Total XP: +75')
      )
    })

    it('should show bonuses when applicable', () => {
      visualizer.showSessionSummary(sampleSessionStats, sampleSessionRewards)

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Quality bonus: +25')
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Streak bonus: +15')
      )
    })

    it('should show level up celebration', () => {
      visualizer.showSessionSummary(sampleSessionStats, sampleSessionRewards)

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('LEVEL UP!')
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('5 → 6')
      )
    })

    it('should show unlocked achievements', () => {
      visualizer.showSessionSummary(sampleSessionStats, sampleSessionRewards)

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('1 Achievement(s) Unlocked!')
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('🎯 Question Master')
      )
    })
  })

  describe('showDailyChallenge', () => {
    const dailyChallenge: DailyChallenge = {
      id: 'daily_2024-01-01',
      date: new Date('2024-01-01'),
      title: 'Question Sprint',
      description: 'Answer 5 questions today',
      type: 'questions',
      target: 5,
      reward: { xp: 50 },
      progress: 3,
      completed: false,
      expiresAt: new Date('2024-01-01T23:59:59Z')
    }

    it('should display daily challenge information', () => {
      visualizer.showDailyChallenge(dailyChallenge)

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('DAILY CHALLENGE')
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Question Sprint')
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Answer 5 questions today')
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Progress: 3/5')
      )
    })

    it('should show completion status for completed challenge', () => {
      const completedChallenge = { ...dailyChallenge, completed: true, progress: 5 }
      
      visualizer.showDailyChallenge(completedChallenge)

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Challenge Completed!')
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Reward: +50 XP')
      )
    })

    it('should show time remaining for incomplete challenge', () => {
      // Mock Date.now to control time calculation
      const mockNow = new Date('2024-01-01T12:00:00Z').getTime()
      vi.spyOn(Date, 'now').mockReturnValue(mockNow)

      visualizer.showDailyChallenge(dailyChallenge)

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('hours remaining')
      )
    })
  })

  describe('showKnowledgeMilestones', () => {
    const milestones: KnowledgeMilestone[] = [
      {
        id: 'insights_10',
        name: 'First Insights',
        description: 'Generate 10 insights',
        icon: '💡',
        threshold: 10,
        metric: 'total_insights',
        achieved: true,
        achievedAt: new Date('2024-01-01')
      },
      {
        id: 'insights_25',
        name: 'Insight Explorer',
        description: 'Generate 25 insights',
        icon: '🔍',
        threshold: 25,
        metric: 'total_insights',
        achieved: false
      }
    ]

    it('should display knowledge milestones', () => {
      visualizer.showKnowledgeMilestones(milestones)

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('KNOWLEDGE MILESTONES')
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('💡 First Insights')
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('🔍 Insight Explorer')
      )
    })

    it('should show achievement status correctly', () => {
      visualizer.showKnowledgeMilestones(milestones)

      const logCalls = mockConsoleLog.mock.calls.map(call => call[0]).join('\n')
      
      expect(logCalls).toContain('✅') // For achieved milestone
      expect(logCalls).toContain('⏳') // For unachieved milestone
      expect(logCalls).toContain('Achieved:') // For achieved milestone
    })
  })

  describe('showWeeklyProgress', () => {
    it('should display weekly progress and goals', () => {
      visualizer.showWeeklyProgress(sampleUserProgress)

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('WEEKLY PROGRESS')
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Questions this week: 15')
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Insights this week: 8')
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Areas explored: 5')
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Weekly Goals:')
      )
    })
  })

  describe('showBadgeShowcase', () => {
    it('should display badges organized by rarity', () => {
      const progressWithBadges = {
        ...sampleUserProgress,
        achievements: [
          {
            ...sampleUserProgress.achievements[0],
            reward: { xp: 10, badge: 'common_badge' }
          },
          {
            id: 'rare_achievement',
            name: 'Rare Achievement',
            description: 'A rare achievement',
            icon: '🏆',
            type: 'milestone' as const,
            requirement: { type: 'questions_answered' as const, value: 50 },
            reward: { xp: 200, badge: 'rare_badge' },
            rarity: 'rare' as const,
            unlockedAt: new Date()
          }
        ]
      }

      visualizer.showBadgeShowcase(progressWithBadges)

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('BADGE COLLECTION')
      )
    })

    it('should show message for no badges', () => {
      const progressNoBadges = {
        ...sampleUserProgress,
        achievements: []
      }

      visualizer.showBadgeShowcase(progressNoBadges)

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No badges earned yet')
      )
    })
  })

  describe('showMotivationalMessage', () => {
    it('should display a motivational message', () => {
      visualizer.showMotivationalMessage(sampleUserProgress)

      const loggedMessages = mockConsoleLog.mock.calls.map(call => call[0])
      const hasMotivationalMessage = loggedMessages.some(message => 
        typeof message === 'string' && 
        (message.includes('knowledge') || message.includes('insights') || message.includes('team'))
      )
      
      expect(hasMotivationalMessage).toBe(true)
    })
  })
})