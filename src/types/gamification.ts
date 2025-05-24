export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  type: 'milestone' | 'streak' | 'quality' | 'discovery' | 'special'
  requirement: {
    type: 'questions_answered' | 'areas_explored' | 'insights_generated' | 'streak_days' | 'confidence_avg' | 'special'
    value: number
    timeframe?: 'session' | 'day' | 'week' | 'all_time'
  }
  reward: {
    xp: number
    badge?: string
    unlocks?: string[]
  }
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  unlockedAt?: Date
}

export interface UserProgress {
  userId: string
  level: number
  xp: number
  xpToNextLevel: number
  totalQuestions: number
  totalAreas: number
  totalInsights: number
  currentStreak: number
  longestStreak: number
  averageConfidence: number
  sessionsCompleted: number
  achievements: Achievement[]
  lastActiveDate: Date
  joinDate: Date
  stats: {
    questionsToday: number
    questionsThisWeek: number
    insightsThisWeek: number
    areasExploredThisWeek: number
  }
}

export interface SessionRewards {
  xpGained: number
  achievementsUnlocked: Achievement[]
  levelUp?: {
    newLevel: number
    previousLevel: number
  }
  streakBonus?: number
  qualityBonus?: number
}

export interface Leaderboard {
  period: 'daily' | 'weekly' | 'monthly' | 'all_time'
  entries: LeaderboardEntry[]
  updatedAt: Date
}

export interface LeaderboardEntry {
  rank: number
  userId: string
  username: string
  score: number
  level: number
  achievements: number
  change: number // position change since last period
}

export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  color: string
  rarity: Achievement['rarity']
  category: string
}

export interface DailyChallenge {
  id: string
  date: Date
  title: string
  description: string
  type: 'questions' | 'areas' | 'quality' | 'speed' | 'exploration'
  target: number
  reward: {
    xp: number
    badge?: string
  }
  progress: number
  completed: boolean
  expiresAt: Date
}

export interface KnowledgeMilestone {
  id: string
  name: string
  description: string
  icon: string
  threshold: number
  metric: 'total_insights' | 'area_coverage' | 'avg_confidence' | 'knowledge_depth'
  achieved: boolean
  achievedAt?: Date
  nextMilestone?: KnowledgeMilestone
}

export interface SessionStats {
  questionsAnswered: number
  areasExplored: number
  insightsGenerated: number
  averageConfidence: number
  timeSpent: number
  streakDay: number
  xpEarned: number
  achievementsUnlocked: number
}

export interface ProgressVisualizer {
  showLevelProgress(progress: UserProgress): void
  showAchievementUnlocked(achievement: Achievement): void
  showSessionSummary(stats: SessionStats, rewards: SessionRewards): void
  showDailyChallenge(challenge: DailyChallenge): void
  showKnowledgeMilestones(milestones: KnowledgeMilestone[]): void
}