/**
 * Interactive CLI experience for knowledge mining sessions
 */

import inquirer from 'inquirer'
import { OutputFormatter } from '../utils/formatting.js'
import {
  Question,
  UserResponse
} from '../types/questions.js'
import {
  SessionContext,
  KnowledgeProgress
} from '../types/core.js'

export class InteractiveSession {
  private formatter: OutputFormatter
  private sessionContext: SessionContext

  constructor(sessionContext: SessionContext) {
    this.formatter = new OutputFormatter()
    this.sessionContext = sessionContext
  }

  /**
   * Present a question to the user and get their response
   */
  async presentQuestion(question: Question): Promise<UserResponse> {
    const startTime = Date.now()
    
    // Clear screen and show progress
    console.clear()
    this.showSessionProgress()
    console.log()
    
    // Display question context
    console.log(question.context)
    console.log()
    
    // Display the main question
    console.log(this.formatter.formatQuestion(
      question.text,
      question.options || [],
      ''
    ))
    
    let selectedOption: string | undefined
    let freeformText: string | undefined
    
    if (question.type === 'multiple-choice' || question.type === 'hybrid') {
      // Multiple choice question
      const choices = [
        ...(question.options?.map(opt => ({ 
          name: `${opt.key}) ${opt.text}`, 
          value: opt.key 
        })) || []),
        { name: 'Other (specify)', value: 'OTHER' }
      ]
      
      const answer = await inquirer.prompt([{
        type: 'list',
        name: 'choice',
        message: 'Your choice:',
        choices,
        pageSize: 10
      }])
      
      selectedOption = answer.choice
      
      // If they chose "Other" or this is a hybrid question, get freeform text
      if (selectedOption === 'OTHER' || question.type === 'hybrid') {
        const followUpMessage = selectedOption === 'OTHER' 
          ? 'Please specify:'
          : question.followUpPrompt || 'Any additional context?'
        
        const textAnswer = await inquirer.prompt([{
          type: 'input',
          name: 'text',
          message: followUpMessage,
          validate: (input: string) => {
            if (selectedOption === 'OTHER' && !input.trim()) {
              return 'Please provide your answer'
            }
            return true
          }
        }])
        
        freeformText = textAnswer.text || undefined
      }
    } else {
      // Freeform question
      const answer = await inquirer.prompt([{
        type: 'input',
        name: 'text',
        message: 'Your answer:',
        validate: (input: string) => {
          if (!input.trim()) {
            return 'Please provide an answer'
          }
          return true
        }
      }])
      
      freeformText = answer.text
    }
    
    const responseTime = Math.floor((Date.now() - startTime) / 1000)
    
    return {
      questionId: question.id,
      selectedOption,
      freeformText,
      timestamp: new Date(),
      sessionId: this.sessionContext.sessionId,
      responseTime
    }
  }

  /**
   * Show session progress and stats
   */
  private showSessionProgress(): void {
    const { questionsAnswered, areasExplored, currentArea } = this.sessionContext
    const sessionTime = Math.floor((Date.now() - this.sessionContext.startTime.getTime()) / 1000)
    
    console.log(this.formatter.formatInfo(
      `Session ${this.sessionContext.sessionId.slice(-6)} • ${this.formatter.formatDuration(sessionTime)} • ${questionsAnswered} questions answered`
    ))
    
    if (currentArea) {
      console.log(this.formatter.formatInfo(
        `Current area: ${this.formatter.formatFilePath(currentArea.path)}`
      ))
    }
    
    console.log(this.formatter.formatInfo(
      `Areas explored: ${areasExplored.length}`
    ))
  }

  /**
   * Show knowledge progress with visual indicators
   */
  showKnowledgeProgress(progress: KnowledgeProgress): void {
    console.log()
    console.log(this.formatter.formatProgress(progress))
    console.log()
  }

  /**
   * Show celebration for milestones
   */
  showCelebration(milestone: string): void {
    console.log()
    console.log(this.formatter.formatCelebration(milestone))
    console.log()
  }

  /**
   * Show impact message after answering
   */
  showImpact(area: string, improvement: number): void {
    console.log()
    console.log(this.formatter.formatImpact(area, improvement))
    console.log()
  }

  /**
   * Ask user if they want to continue the session
   */
  async askToContinue(): Promise<boolean> {
    const answer = await inquirer.prompt([{
      type: 'confirm',
      name: 'continue',
      message: 'Continue with more questions?',
      default: true
    }])
    
    return answer.continue
  }

  /**
   * Ask user about session length preference
   */
  async askSessionLength(): Promise<'quick' | 'medium' | 'deep'> {
    const answer = await inquirer.prompt([{
      type: 'list',
      name: 'length',
      message: 'What type of session would you like?',
      choices: [
        { name: '🏃‍♂️ Quick (5-10 minutes, 3-5 questions)', value: 'quick' },
        { name: '🚶‍♂️ Medium (15-20 minutes, 7-10 questions)', value: 'medium' },
        { name: '🧘‍♂️ Deep Dive (30+ minutes, comprehensive)', value: 'deep' }
      ],
      default: 'medium'
    }])
    
    return answer.length
  }

  /**
   * Ask user to select focus areas
   */
  async askFocusAreas(availableAreas: string[]): Promise<string[]> {
    if (availableAreas.length === 0) {
      return []
    }
    
    const answer = await inquirer.prompt([{
      type: 'checkbox',
      name: 'areas',
      message: 'Which areas would you like to focus on? (optional)',
      choices: availableAreas.map(area => ({ name: area, value: area })),
      pageSize: 10
    }])
    
    return answer.areas || []
  }

  /**
   * Show session summary
   */
  showSessionSummary(
    questionsAnswered: number,
    timeSpent: number,
    areasExplored: string[],
    newInsights: number
  ): void {
    console.clear()
    console.log(this.formatter.formatSessionSummary(
      questionsAnswered,
      timeSpent,
      areasExplored,
      newInsights
    ))
  }

  /**
   * Show error message
   */
  showError(error: string, context?: string): void {
    console.log()
    console.log(this.formatter.formatError(error, context))
    console.log()
  }

  /**
   * Show warning message
   */
  showWarning(warning: string): void {
    console.log()
    console.log(this.formatter.formatWarning(warning))
    console.log()
  }

  /**
   * Show loading indicator
   */
  showLoading(message: string): void {
    process.stdout.write(`⏳ ${message}...`)
  }

  /**
   * Clear loading indicator
   */
  clearLoading(): void {
    process.stdout.write('\r\x1b[K') // Clear current line
  }

  /**
   * Pause and wait for user input
   */
  async pause(message: string = 'Press Enter to continue...'): Promise<void> {
    await inquirer.prompt([{
      type: 'input',
      name: 'continue',
      message,
      default: ''
    }])
  }

  /**
   * Ask for confirmation
   */
  async confirm(message: string, defaultValue: boolean = true): Promise<boolean> {
    const answer = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmed',
      message,
      default: defaultValue
    }])
    
    return answer.confirmed
  }

  /**
   * Show welcome message
   */
  showWelcome(): void {
    console.clear()
    console.log('🎯 Welcome to ylog2 - Interactive Knowledge Mining!')
    console.log()
    console.log('I\'ll explore your codebase and ask questions to help build')
    console.log('institutional knowledge about your code decisions.')
    console.log()
    console.log('Your answers will be synthesized into searchable knowledge')
    console.log('that helps future developers understand the "why" behind your code.')
    console.log()
  }

  /**
   * Show goodbye message
   */
  showGoodbye(): void {
    console.log()
    console.log('👋 Thank you for contributing to your codebase knowledge!')
    console.log('Your insights have been saved and will help future developers.')
    console.log()
    console.log('Run "ylog2 status" to see your knowledge building progress.')
    console.log()
  }

  /**
   * Handle interruption (Ctrl+C)
   */
  async handleInterruption(): Promise<'save' | 'discard' | 'continue'> {
    console.log()
    console.log('⏸️  Session interrupted')
    console.log()
    
    const answer = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '💾 Save progress and exit', value: 'save' },
        { name: '🗑️  Discard progress and exit', value: 'discard' },
        { name: '▶️  Continue session', value: 'continue' }
      ]
    }])
    
    return answer.action
  }

  /**
   * Show tips for better responses
   */
  showTips(): void {
    console.log(this.formatter.formatInfo('💡 Tips for great answers:'))
    console.log('• Think about WHY you made the decision, not just what you did')
    console.log('• Mention business requirements or user needs that influenced you')
    console.log('• Share alternatives you considered and why you chose this approach')
    console.log('• Include any trade-offs or compromises you had to make')
    console.log()
  }
}