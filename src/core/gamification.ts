import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import {
  Achievement,
  UserProgress,
  SessionRewards,
  SessionStats,
  DailyChallenge,
  KnowledgeMilestone,
  Badge
} from '../types/gamification.js'

export class GamificationEngine {
  private dataPath: string
  private achievements: Achievement[] = []
  private badges: Badge[] = []
  private userProgress: UserProgress | null = null

  constructor(dataDir: string) {
    this.dataPath = join(dataDir, 'gamification')
    this.ensureDataDirectory()
    this.initializeAchievements()
    this.initializeBadges()
  }

  private ensureDataDirectory(): void {
    if (!existsSync(this.dataPath)) {
      mkdirSync(this.dataPath, { recursive: true })
    }
  }

  private initializeAchievements(): void {
    this.achievements = [
      // Milestone Achievements
      {
        id: 'first_question',
        name: 'Knowledge Seeker',
        description: 'Answer your first question',
        icon: '🌱',
        type: 'milestone',
        requirement: { type: 'questions_answered', value: 1 },
        reward: { xp: 10 },
        rarity: 'common'
      },
      {
        id: 'question_master_10',
        name: 'Question Master',
        description: 'Answer 10 questions',
        icon: '🎯',
        type: 'milestone',
        requirement: { type: 'questions_answered', value: 10 },
        reward: { xp: 50, badge: 'question_master' },
        rarity: 'uncommon'
      },
      {
        id: 'question_sage_50',
        name: 'Question Sage',
        description: 'Answer 50 questions',
        icon: '🧙‍♂️',
        type: 'milestone',
        requirement: { type: 'questions_answered', value: 50 },
        reward: { xp: 200, badge: 'sage' },
        rarity: 'rare'
      },
      {
        id: 'knowledge_guru_100',
        name: 'Knowledge Guru',
        description: 'Answer 100 questions',
        icon: '🏆',
        type: 'milestone',
        requirement: { type: 'questions_answered', value: 100 },
        reward: { xp: 500, badge: 'guru' },
        rarity: 'epic'
      },

      // Area Exploration Achievements
      {
        id: 'area_explorer',
        name: 'Area Explorer',
        description: 'Explore 5 different code areas',
        icon: '🗺️',
        type: 'discovery',
        requirement: { type: 'areas_explored', value: 5 },
        reward: { xp: 30 },
        rarity: 'common'
      },
      {
        id: 'codebase_cartographer',
        name: 'Codebase Cartographer',
        description: 'Explore 20 different code areas',
        icon: '🧭',
        type: 'discovery',
        requirement: { type: 'areas_explored', value: 20 },
        reward: { xp: 150, badge: 'cartographer' },
        rarity: 'rare'
      },

      // Quality Achievements
      {
        id: 'quality_contributor',
        name: 'Quality Contributor',
        description: 'Maintain 80% average confidence',
        icon: '⭐',
        type: 'quality',
        requirement: { type: 'confidence_avg', value: 0.8 },
        reward: { xp: 100 },
        rarity: 'uncommon'
      },
      {
        id: 'insight_master',
        name: 'Insight Master',
        description: 'Generate 25 high-quality insights',
        icon: '💡',
        type: 'quality',
        requirement: { type: 'insights_generated', value: 25 },
        reward: { xp: 200, badge: 'insight_master' },
        rarity: 'rare'
      },

      // Streak Achievements
      {
        id: 'daily_dedication_3',
        name: 'Daily Dedication',
        description: 'Complete sessions for 3 days in a row',
        icon: '🔥',
        type: 'streak',
        requirement: { type: 'streak_days', value: 3 },
        reward: { xp: 75 },
        rarity: 'uncommon'
      },
      {
        id: 'unstoppable_7',
        name: 'Unstoppable',
        description: 'Complete sessions for 7 days in a row',
        icon: '⚡',
        type: 'streak',
        requirement: { type: 'streak_days', value: 7 },
        reward: { xp: 250, badge: 'unstoppable' },
        rarity: 'epic'
      },
      {
        id: 'legendary_streak_30',
        name: 'Legendary Streak',
        description: 'Complete sessions for 30 days in a row',
        icon: '👑',
        type: 'streak',
        requirement: { type: 'streak_days', value: 30 },
        reward: { xp: 1000, badge: 'legendary' },
        rarity: 'legendary'
      },

      // Special Achievements
      {
        id: 'early_adopter',
        name: 'Early Adopter',
        description: 'One of the first to use ylog2',
        icon: '🚀',
        type: 'special',
        requirement: { type: 'special', value: 1 },
        reward: { xp: 100, badge: 'early_adopter' },
        rarity: 'rare'
      },
      {
        id: 'knowledge_architect',
        name: 'Knowledge Architect',
        description: 'Help build the foundation of codebase knowledge',
        icon: '🏗️',
        type: 'special',
        requirement: { type: 'insights_generated', value: 50 },
        reward: { xp: 300, badge: 'architect' },
        rarity: 'epic'
      }
    ]
  }

  private initializeBadges(): void {
    this.badges = [
      {
        id: 'question_master',
        name: 'Question Master',
        description: 'Mastery in answering questions',
        icon: '🎯',
        color: '#3B82F6',
        rarity: 'uncommon',
        category: 'Questions'
      },
      {
        id: 'sage',
        name: 'Sage',
        description: 'Wisdom through experience',
        icon: '🧙‍♂️',
        color: '#8B5CF6',
        rarity: 'rare',
        category: 'Mastery'
      },
      {
        id: 'guru',
        name: 'Guru',
        description: 'Master of knowledge',
        icon: '🏆',
        color: '#F59E0B',
        rarity: 'epic',
        category: 'Mastery'
      },
      {
        id: 'cartographer',
        name: 'Cartographer',
        description: 'Explorer of code territories',
        icon: '🧭',
        color: '#10B981',
        rarity: 'rare',
        category: 'Exploration'
      },
      {
        id: 'insight_master',
        name: 'Insight Master',
        description: 'Generator of valuable insights',
        icon: '💡',
        color: '#F59E0B',
        rarity: 'rare',
        category: 'Quality'
      },
      {
        id: 'unstoppable',
        name: 'Unstoppable',
        description: 'Unwavering dedication',
        icon: '⚡',
        color: '#EF4444',
        rarity: 'epic',
        category: 'Dedication'
      },
      {
        id: 'legendary',
        name: 'Legendary',
        description: 'Legendary commitment to knowledge',
        icon: '👑',
        color: '#DC2626',
        rarity: 'legendary',
        category: 'Dedication'
      },
      {
        id: 'early_adopter',
        name: 'Early Adopter',
        description: 'Pioneer of ylog2',
        icon: '🚀',
        color: '#6366F1',
        rarity: 'rare',
        category: 'Special'
      },
      {
        id: 'architect',
        name: 'Architect',
        description: 'Builder of knowledge foundations',
        icon: '🏗️',
        color: '#059669',
        rarity: 'epic',
        category: 'Special'
      }
    ]
  }

  async loadUserProgress(): Promise<UserProgress> {
    const progressFile = join(this.dataPath, 'progress.json')
    
    if (existsSync(progressFile)) {
      try {
        const content = readFileSync(progressFile, 'utf-8')
        const data = JSON.parse(content)
        
        // Convert date strings back to Date objects
        data.lastActiveDate = new Date(data.lastActiveDate)
        data.joinDate = new Date(data.joinDate)
        data.achievements = data.achievements.map((a: any) => ({
          ...a,
          unlockedAt: a.unlockedAt ? new Date(a.unlockedAt) : undefined
        }))
        
        this.userProgress = data
        return data
      } catch (error) {
        console.warn('Failed to load user progress:', error)
      }
    }
    
    // Create new user progress
    const newProgress: UserProgress = {
      userId: crypto.randomUUID(),
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      totalQuestions: 0,
      totalAreas: 0,
      totalInsights: 0,
      currentStreak: 0,
      longestStreak: 0,
      averageConfidence: 0,
      sessionsCompleted: 0,
      achievements: [],
      lastActiveDate: new Date(),
      joinDate: new Date(),
      stats: {
        questionsToday: 0,
        questionsThisWeek: 0,
        insightsThisWeek: 0,
        areasExploredThisWeek: 0
      }
    }
    
    this.userProgress = newProgress
    await this.saveUserProgress()
    return newProgress
  }

  async saveUserProgress(): Promise<void> {
    if (!this.userProgress) return
    
    const progressFile = join(this.dataPath, 'progress.json')
    
    try {
      writeFileSync(progressFile, JSON.stringify(this.userProgress, null, 2))
    } catch (error) {
      console.warn('Failed to save user progress:', error)
    }
  }

  async calculateSessionRewards(stats: SessionStats): Promise<SessionRewards> {
    if (!this.userProgress) {
      await this.loadUserProgress()
    }
    
    let baseXP = stats.questionsAnswered * 10
    let streakBonus = 0
    let qualityBonus = 0
    
    // Calculate quality bonus
    if (stats.averageConfidence > 0.8) {
      qualityBonus = Math.floor(baseXP * 0.5)
    } else if (stats.averageConfidence > 0.6) {
      qualityBonus = Math.floor(baseXP * 0.25)
    }
    
    // Calculate streak bonus
    if (this.userProgress!.currentStreak > 1) {
      streakBonus = Math.floor(baseXP * (this.userProgress!.currentStreak * 0.1))
    }
    
    const totalXP = baseXP + qualityBonus + streakBonus
    
    // Update user progress
    this.userProgress!.totalQuestions += stats.questionsAnswered
    this.userProgress!.totalAreas += stats.areasExplored
    this.userProgress!.totalInsights += stats.insightsGenerated
    this.userProgress!.sessionsCompleted += 1
    this.userProgress!.lastActiveDate = new Date()
    
    // Update averages
    if (this.userProgress!.totalQuestions > 0) {
      this.userProgress!.averageConfidence = 
        (this.userProgress!.averageConfidence * (this.userProgress!.totalQuestions - stats.questionsAnswered) + 
         stats.averageConfidence * stats.questionsAnswered) / this.userProgress!.totalQuestions
    }
    
    // Update streak
    const today = new Date().toDateString()
    const lastActive = this.userProgress!.lastActiveDate.toDateString()
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString()
    
    if (lastActive === yesterday) {
      this.userProgress!.currentStreak += 1
    } else if (lastActive !== today) {
      this.userProgress!.currentStreak = 1
    }
    
    if (this.userProgress!.currentStreak > this.userProgress!.longestStreak) {
      this.userProgress!.longestStreak = this.userProgress!.currentStreak
    }
    
    // Add XP and check for level up
    const oldLevel = this.userProgress!.level
    this.userProgress!.xp += totalXP
    
    let levelUp: { newLevel: number; previousLevel: number } | undefined
    while (this.userProgress!.xp >= this.userProgress!.xpToNextLevel) {
      this.userProgress!.xp -= this.userProgress!.xpToNextLevel
      this.userProgress!.level += 1
      this.userProgress!.xpToNextLevel = this.calculateXPForLevel(this.userProgress!.level + 1)
    }
    
    if (this.userProgress!.level > oldLevel) {
      levelUp = { newLevel: this.userProgress!.level, previousLevel: oldLevel }
    }
    
    // Check for achievements
    const newAchievements = await this.checkAchievements()
    
    await this.saveUserProgress()
    
    return {
      xpGained: totalXP,
      achievementsUnlocked: newAchievements,
      levelUp,
      streakBonus: streakBonus > 0 ? streakBonus : undefined,
      qualityBonus: qualityBonus > 0 ? qualityBonus : undefined
    }
  }

  private async checkAchievements(): Promise<Achievement[]> {
    if (!this.userProgress) return []
    
    const newAchievements: Achievement[] = []
    const unlockedIds = new Set(this.userProgress.achievements.map(a => a.id))
    
    for (const achievement of this.achievements) {
      if (unlockedIds.has(achievement.id)) continue
      
      let unlocked = false
      
      switch (achievement.requirement.type) {
        case 'questions_answered':
          unlocked = this.userProgress.totalQuestions >= achievement.requirement.value
          break
        case 'areas_explored':
          unlocked = this.userProgress.totalAreas >= achievement.requirement.value
          break
        case 'insights_generated':
          unlocked = this.userProgress.totalInsights >= achievement.requirement.value
          break
        case 'streak_days':
          unlocked = this.userProgress.currentStreak >= achievement.requirement.value
          break
        case 'confidence_avg':
          unlocked = this.userProgress.averageConfidence >= achievement.requirement.value
          break
        case 'special':
          // Special achievements are unlocked manually
          break
      }
      
      if (unlocked) {
        const unlockedAchievement = {
          ...achievement,
          unlockedAt: new Date()
        }
        
        this.userProgress.achievements.push(unlockedAchievement)
        newAchievements.push(unlockedAchievement)
        
        // Award XP
        this.userProgress.xp += achievement.reward.xp
      }
    }
    
    return newAchievements
  }

  private calculateXPForLevel(level: number): number {
    return Math.floor(100 * Math.pow(1.5, level - 1))
  }

  async generateDailyChallenge(): Promise<DailyChallenge> {
    const today = new Date()
    const challengeTypes = [
      {
        type: 'questions' as const,
        title: 'Question Sprint',
        description: 'Answer {target} questions today',
        target: 5 + Math.floor(Math.random() * 5),
        xp: 50
      },
      {
        type: 'areas' as const,
        title: 'Area Explorer',
        description: 'Explore {target} different code areas',
        target: 3 + Math.floor(Math.random() * 3),
        xp: 40
      },
      {
        type: 'quality' as const,
        title: 'Quality Focus',
        description: 'Maintain {target}% average confidence',
        target: 75 + Math.floor(Math.random() * 20),
        xp: 75
      }
    ]
    
    const challenge = challengeTypes[Math.floor(Math.random() * challengeTypes.length)]
    const expiresAt = new Date(today)
    expiresAt.setHours(23, 59, 59, 999)
    
    return {
      id: `daily_${today.toISOString().split('T')[0]}`,
      date: today,
      title: challenge.title,
      description: challenge.description.replace('{target}', challenge.target.toString()),
      type: challenge.type,
      target: challenge.target,
      reward: { xp: challenge.xp },
      progress: 0,
      completed: false,
      expiresAt
    }
  }

  getKnowledgeMilestones(): KnowledgeMilestone[] {
    if (!this.userProgress) return []
    
    const milestones: KnowledgeMilestone[] = [
      {
        id: 'insights_10',
        name: 'First Insights',
        description: 'Generate 10 insights',
        icon: '💡',
        threshold: 10,
        metric: 'total_insights',
        achieved: this.userProgress.totalInsights >= 10,
        achievedAt: this.userProgress.totalInsights >= 10 ? new Date() : undefined
      },
      {
        id: 'insights_25',
        name: 'Insight Explorer',
        description: 'Generate 25 insights',
        icon: '🔍',
        threshold: 25,
        metric: 'total_insights',
        achieved: this.userProgress.totalInsights >= 25,
        achievedAt: this.userProgress.totalInsights >= 25 ? new Date() : undefined
      },
      {
        id: 'insights_50',
        name: 'Knowledge Builder',
        description: 'Generate 50 insights',
        icon: '🏗️',
        threshold: 50,
        metric: 'total_insights',
        achieved: this.userProgress.totalInsights >= 50,
        achievedAt: this.userProgress.totalInsights >= 50 ? new Date() : undefined
      },
      {
        id: 'confidence_80',
        name: 'Quality Curator',
        description: 'Maintain 80% average confidence',
        icon: '⭐',
        threshold: 0.8,
        metric: 'avg_confidence',
        achieved: this.userProgress.averageConfidence >= 0.8,
        achievedAt: this.userProgress.averageConfidence >= 0.8 ? new Date() : undefined
      }
    ]
    
    // Set next milestones
    for (let i = 0; i < milestones.length - 1; i++) {
      if (milestones[i].achieved && !milestones[i + 1].achieved) {
        milestones[i].nextMilestone = milestones[i + 1]
        break
      }
    }
    
    return milestones
  }

  getUserProgress(): UserProgress | null {
    return this.userProgress
  }

  getAllAchievements(): Achievement[] {
    return this.achievements
  }

  getAllBadges(): Badge[] {
    return this.badges
  }
}