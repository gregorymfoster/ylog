import chalk from 'chalk'
import {
  Achievement,
  UserProgress,
  SessionStats,
  SessionRewards,
  DailyChallenge,
  KnowledgeMilestone,
  ProgressVisualizer
} from '../types/gamification.js'

export class ConsoleProgressVisualizer implements ProgressVisualizer {
  
  showLevelProgress(progress: UserProgress): void {
    const levelProgress = (progress.xpToNextLevel - progress.xp) / progress.xpToNextLevel
    const progressBar = this.createProgressBar(1 - levelProgress, 20)
    
    console.log()
    console.log(chalk.bold.blue(`🎯 Level ${progress.level}`))
    console.log(chalk.gray(`${progress.xp} / ${progress.xpToNextLevel} XP`))
    console.log(progressBar)
    console.log()
    
    // Show streak if active
    if (progress.currentStreak > 1) {
      console.log(chalk.yellow(`🔥 ${progress.currentStreak} day streak!`))
    }
    
    // Show level badge
    const levelBadge = this.getLevelBadge(progress.level)
    if (levelBadge) {
      console.log(chalk.cyan(`${levelBadge.icon} ${levelBadge.name}`))
    }
    console.log()
  }

  showAchievementUnlocked(achievement: Achievement): void {
    const rarityColor = this.getRarityColor(achievement.rarity)
    const border = '═'.repeat(50)
    
    console.log()
    console.log(rarityColor(border))
    console.log(rarityColor('🏆 ACHIEVEMENT UNLOCKED! 🏆'))
    console.log()
    console.log(chalk.bold(`${achievement.icon} ${achievement.name}`))
    console.log(chalk.gray(achievement.description))
    console.log()
    console.log(chalk.green(`+${achievement.reward.xp} XP`))
    
    if (achievement.reward.badge) {
      console.log(chalk.blue(`🏅 Badge: ${achievement.reward.badge}`))
    }
    
    console.log(rarityColor(border))
    console.log()
  }

  showSessionSummary(stats: SessionStats, rewards: SessionRewards): void {
    console.log()
    console.log(chalk.bold.green('📊 SESSION COMPLETE!'))
    console.log()
    
    // Session stats
    console.log(chalk.bold('Session Stats:'))
    console.log(`• Questions answered: ${chalk.cyan(stats.questionsAnswered.toString())}`)
    console.log(`• Areas explored: ${chalk.cyan(stats.areasExplored.toString())}`)
    console.log(`• Insights generated: ${chalk.cyan(stats.insightsGenerated.toString())}`)
    console.log(`• Average confidence: ${chalk.cyan((stats.averageConfidence * 100).toFixed(1) + '%')}`)
    console.log(`• Time spent: ${chalk.cyan(this.formatTime(stats.timeSpent))}`)
    console.log()
    
    // Rewards
    console.log(chalk.bold('Rewards Earned:'))
    console.log(`• Base XP: ${chalk.green(`+${stats.questionsAnswered * 10}`)}`)
    
    if (rewards.qualityBonus) {
      console.log(`• Quality bonus: ${chalk.green(`+${rewards.qualityBonus}`)} ${chalk.gray('(high confidence)')}`))
    }
    
    if (rewards.streakBonus) {
      console.log(`• Streak bonus: ${chalk.green(`+${rewards.streakBonus}`)} ${chalk.gray(`(${stats.streakDay} day streak)`)}`))
    }
    
    console.log(`• ${chalk.bold.green(`Total XP: +${rewards.xpGained}`)}`)
    console.log()
    
    // Level up
    if (rewards.levelUp) {
      this.showLevelUp(rewards.levelUp.previousLevel, rewards.levelUp.newLevel)
    }
    
    // New achievements
    if (rewards.achievementsUnlocked.length > 0) {
      console.log(chalk.bold.yellow(`🏆 ${rewards.achievementsUnlocked.length} Achievement(s) Unlocked!`))
      for (const achievement of rewards.achievementsUnlocked) {
        console.log(`${achievement.icon} ${achievement.name}`)
      }
      console.log()
    }
  }

  showDailyChallenge(challenge: DailyChallenge): void {
    const progressPercent = Math.min(challenge.progress / challenge.target, 1)
    const progressBar = this.createProgressBar(progressPercent, 15)
    
    console.log()
    console.log(chalk.bold.magenta('🎯 DAILY CHALLENGE'))
    console.log(chalk.bold(challenge.title))
    console.log(chalk.gray(challenge.description))
    console.log()
    console.log(`Progress: ${challenge.progress}/${challenge.target}`)
    console.log(progressBar)
    console.log()
    
    if (challenge.completed) {
      console.log(chalk.green('✅ Challenge Completed!'))
      console.log(chalk.green(`🎁 Reward: +${challenge.reward.xp} XP`))
    } else {
      const timeLeft = challenge.expiresAt.getTime() - Date.now()
      const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60))
      console.log(chalk.yellow(`⏰ ${hoursLeft} hours remaining`))
    }
    console.log()
  }

  showKnowledgeMilestones(milestones: KnowledgeMilestone[]): void {
    console.log()
    console.log(chalk.bold.blue('🏗️ KNOWLEDGE MILESTONES'))
    console.log()
    
    for (const milestone of milestones) {
      const status = milestone.achieved ? 
        chalk.green('✅') : 
        chalk.gray('⏳')
      
      console.log(`${status} ${milestone.icon} ${milestone.name}`)
      console.log(`   ${chalk.gray(milestone.description)}`)
      
      if (milestone.achieved && milestone.achievedAt) {
        console.log(`   ${chalk.green('Achieved:')} ${milestone.achievedAt.toLocaleDateString()}`)
      } else if (milestone.nextMilestone) {
        console.log(`   ${chalk.yellow('Next:')} ${milestone.nextMilestone.name}`)
      }
      console.log()
    }
  }

  showWeeklyProgress(progress: UserProgress): void {
    console.log()
    console.log(chalk.bold.blue('📈 WEEKLY PROGRESS'))
    console.log()
    console.log(`Questions this week: ${chalk.cyan(progress.stats.questionsThisWeek.toString())}`)
    console.log(`Insights this week: ${chalk.cyan(progress.stats.insightsThisWeek.toString())}`)
    console.log(`Areas explored: ${chalk.cyan(progress.stats.areasExploredThisWeek.toString())}`)
    console.log()
    
    // Show progress toward weekly goals
    const weeklyGoals = {
      questions: 20,
      insights: 10,
      areas: 8
    }
    
    console.log(chalk.bold('Weekly Goals:'))
    this.showGoalProgress('Questions', progress.stats.questionsThisWeek, weeklyGoals.questions)
    this.showGoalProgress('Insights', progress.stats.insightsThisWeek, weeklyGoals.insights)
    this.showGoalProgress('Areas', progress.stats.areasExploredThisWeek, weeklyGoals.areas)
    console.log()
  }

  showBadgeShowcase(progress: UserProgress): void {
    const badges = progress.achievements.filter(a => a.reward.badge)
    
    if (badges.length === 0) {
      console.log(chalk.gray('No badges earned yet. Keep exploring to unlock your first badge!'))
      return
    }
    
    console.log()
    console.log(chalk.bold.yellow('🏅 BADGE COLLECTION'))
    console.log()
    
    const badgesByRarity = badges.reduce((acc, achievement) => {
      const rarity = achievement.rarity
      if (!acc[rarity]) acc[rarity] = []
      acc[rarity].push(achievement)
      return acc
    }, {} as Record<string, Achievement[]>)
    
    const rarityOrder = ['legendary', 'epic', 'rare', 'uncommon', 'common']
    
    for (const rarity of rarityOrder) {
      if (badgesByRarity[rarity]) {
        const color = this.getRarityColor(rarity as Achievement['rarity'])
        console.log(color(rarity.toUpperCase()))
        
        for (const achievement of badgesByRarity[rarity]) {
          console.log(`  ${achievement.icon} ${achievement.name}`)
        }
        console.log()
      }
    }
  }

  private showLevelUp(oldLevel: number, newLevel: number): void {
    const border = '★'.repeat(40)
    console.log(chalk.bold.yellow(border))
    console.log(chalk.bold.yellow('✨ LEVEL UP! ✨'))
    console.log(chalk.bold(`${oldLevel} → ${newLevel}`))
    console.log(chalk.bold.yellow(border))
    console.log()
  }

  private showGoalProgress(name: string, current: number, target: number): void {
    const progress = Math.min(current / target, 1)
    const progressBar = this.createProgressBar(progress, 10)
    const status = current >= target ? chalk.green('✅') : chalk.yellow('⏳')
    
    console.log(`${status} ${name}: ${current}/${target} ${progressBar}`)
  }

  private createProgressBar(progress: number, length: number): string {
    const filled = Math.floor(progress * length)
    const empty = length - filled
    
    const filledChar = chalk.green('█')
    const emptyChar = chalk.gray('░')
    
    return `[${filledChar.repeat(filled)}${emptyChar.repeat(empty)}] ${(progress * 100).toFixed(1)}%`
  }

  private getRarityColor(rarity: Achievement['rarity']) {
    switch (rarity) {
      case 'common': return chalk.gray
      case 'uncommon': return chalk.green
      case 'rare': return chalk.blue
      case 'epic': return chalk.magenta
      case 'legendary': return chalk.yellow
      default: return chalk.white
    }
  }

  private getLevelBadge(level: number): { icon: string; name: string } | null {
    if (level >= 50) return { icon: '👑', name: 'Legend' }
    if (level >= 25) return { icon: '🏆', name: 'Master' }
    if (level >= 15) return { icon: '⭐', name: 'Expert' }
    if (level >= 10) return { icon: '🎯', name: 'Skilled' }
    if (level >= 5) return { icon: '🌟', name: 'Intermediate' }
    return { icon: '🌱', name: 'Novice' }
  }

  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    }
    return `${remainingSeconds}s`
  }

  showMotivationalMessage(progress: UserProgress): void {
    const messages = [
      "Every question answered adds to your codebase's institutional memory! 🧠",
      "Your insights today will help future developers tomorrow! 🚀",
      "Knowledge shared is knowledge multiplied! ✨",
      "You're building something bigger than code - you're building understanding! 🏗️",
      "Each session makes your team smarter! 🎯",
      "Documentation through conversation - brilliant! 💡"
    ]
    
    const message = messages[Math.floor(Math.random() * messages.length)]
    console.log()
    console.log(chalk.italic.cyan(message))
    console.log()
  }
}