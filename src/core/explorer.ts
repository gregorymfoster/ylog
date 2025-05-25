/**
 * Code Explorer Agent for intelligent codebase analysis
 */

import { readdirSync, statSync } from 'fs'
import { join, relative, extname } from 'path'
import { GitAnalyzer } from '../utils/git.js'
import { FileAnalyzer } from '../utils/file-analysis.js'
import { 
  CodeArea, 
  AreaAnalysis, 
  QuestionTarget, 
  ArchitecturalPattern,
  ResolvedYlog2Config 
} from '../types/index.js'

export class CodeExplorer {
  private config: ResolvedYlog2Config
  private gitAnalyzer: GitAnalyzer
  private fileAnalyzer: FileAnalyzer
  private exploreCache: Map<string, CodeArea> = new Map()

  constructor(config: ResolvedYlog2Config) {
    this.config = config
    this.gitAnalyzer = new GitAnalyzer(config.repoRoot)
    this.fileAnalyzer = new FileAnalyzer()
  }

  /**
   * Explore the entire codebase and identify areas of interest
   */
  async exploreCodebase(): Promise<CodeArea[]> {
    const areas: CodeArea[] = []
    const { focusAreas, ignorePatterns, maxDepth, supportedLanguages } = this.config.exploration

    // Start exploration from focus areas or repo root
    const startPaths = focusAreas.length > 0 
      ? focusAreas.map(area => join(this.config.repoRoot, area))
      : [this.config.repoRoot]

    for (const startPath of startPaths) {
      try {
        // Check if path exists before exploring
        if (!existsSync(startPath)) {
          console.warn(`Skipping non-existent path: ${startPath}`)
          continue
        }
        
        const exploredAreas = await this.exploreDirectory(
          startPath, 
          0, 
          maxDepth, 
          ignorePatterns,
          supportedLanguages
        )
        areas.push(...exploredAreas)
      } catch (error) {
        console.warn(`Failed to explore ${startPath}: ${error}`)
        continue
      }
    }

    // Enhance areas with git analysis
    await this.enhanceWithGitData(areas)

    // Sort by priority (combination of complexity and change frequency)
    areas.sort((a, b) => this.calculatePriority(b) - this.calculatePriority(a))

    return areas
  }

  /**
   * Recursively explore a directory
   */
  private async exploreDirectory(
    dirPath: string,
    currentDepth: number,
    maxDepth: number,
    ignorePatterns: string[],
    supportedLanguages: string[]
  ): Promise<CodeArea[]> {
    if (currentDepth > maxDepth) return []

    const areas: CodeArea[] = []
    
    try {
      const entries = readdirSync(dirPath)
      const files: string[] = []
      const subdirs: string[] = []

      // Categorize entries
      for (const entry of entries) {
        const fullPath = join(dirPath, entry)
        const relativePath = relative(this.config.repoRoot, fullPath)

        // Check ignore patterns
        if (this.shouldIgnore(relativePath, ignorePatterns)) {
          continue
        }

        const stat = statSync(fullPath)
        
        if (stat.isDirectory()) {
          subdirs.push(fullPath)
        } else if (stat.isFile()) {
          const ext = extname(entry)
          const language = this.detectLanguage(ext)
          
          // Check file size and language constraints
          if (stat.size >= this.config.exploration.minFileSize &&
              stat.size <= this.config.exploration.maxFileSize &&
              (supportedLanguages.includes(language) || supportedLanguages.length === 0)) {
            
            // Check if tests should be included
            if (!this.config.exploration.includeTests && this.isTestFile(fullPath)) {
              continue
            }
            
            files.push(fullPath)
          }
        }
      }

      // Create area for current directory if it has relevant files
      if (files.length > 0) {
        const dirArea = await this.fileAnalyzer.analyzeDirectory(dirPath, files)
        
        // Cache individual files too
        for (const file of files) {
          if (!this.exploreCache.has(file)) {
            try {
              const fileArea = await this.fileAnalyzer.analyzeFile(file)
              this.exploreCache.set(file, fileArea)
              
              // Add individual files as areas if they're complex enough
              if (fileArea.complexity > 20) {
                areas.push(fileArea)
              }
            } catch {
              // Skip files that can't be analyzed
            }
          }
        }

        areas.push(dirArea)
      }

      // Recursively explore subdirectories
      for (const subdir of subdirs) {
        const subAreas = await this.exploreDirectory(
          subdir, 
          currentDepth + 1, 
          maxDepth, 
          ignorePatterns,
          supportedLanguages
        )
        areas.push(...subAreas)
      }

    } catch (error) {
      console.warn(`Failed to read directory ${dirPath}: ${error}`)
    }

    return areas
  }

  /**
   * Enhance areas with git data (contributors, change frequency)
   */
  private async enhanceWithGitData(areas: CodeArea[]): Promise<void> {
    const recentChanges = await this.gitAnalyzer.getRecentChanges(
      areas.map(area => area.path),
      30 // Last 30 days
    )

    // Create change frequency map
    const changeFrequencyMap = new Map<string, number>()
    for (const change of recentChanges) {
      const current = changeFrequencyMap.get(change.file) || 0
      changeFrequencyMap.set(change.file, current + 1)
    }

    // Enhance each area
    for (const area of areas) {
      try {
        // Get contributors
        if (this.gitAnalyzer.isTracked(area.path)) {
          area.contributors = await this.gitAnalyzer.getContributors(area.path)
          area.changeFrequency = changeFrequencyMap.get(area.path) || 0
        }
      } catch {
        // Git operations can fail for various reasons, continue gracefully
        area.contributors = []
        area.changeFrequency = 0
      }
    }
  }

  /**
   * Analyze a specific area in detail
   */
  async analyzeArea(area: CodeArea): Promise<AreaAnalysis> {
    const patterns = await this.detectAreaPatterns(area)
    const hotSpots = await this.identifyHotSpots(area)
    const contextGaps = await this.findContextGaps(area)
    const recentChanges = await this.gitAnalyzer.getRecentChanges([area.path], 30)
    const dependencies = await this.analyzeDependencies(area)

    return {
      area,
      patterns,
      hotSpots,
      contextGaps,
      recentChanges,
      dependencies
    }
  }

  /**
   * Identify questionable code that needs context
   */
  async identifyQuestionableCode(analysis: AreaAnalysis): Promise<QuestionTarget[]> {
    const targets: QuestionTarget[] = []
    const { area, hotSpots, contextGaps, recentChanges } = analysis

    // High complexity code without context
    for (const hotSpot of hotSpots) {
      if (hotSpot.reason === 'high_complexity' && hotSpot.score > 25) {
        const target = await this.createQuestionTarget(
          area,
          'architecture',
          hotSpot.file,
          85 // High priority for complex code
        )
        if (target) targets.push(target)
      }
    }

    // Recently changed files that might need explanation
    for (const change of recentChanges.slice(0, 5)) { // Top 5 recent changes
      if (change.linesChanged > 10) {
        const target = await this.createQuestionTarget(
          area,
          'why',
          change.file,
          70 + Math.min(change.linesChanged, 30) // Priority based on change size
        )
        if (target) targets.push(target)
      }
    }

    // Context gaps (complex code without comments)
    for (const gap of contextGaps) {
      if (gap.severity === 'high') {
        const target = await this.createQuestionTarget(
          area,
          'business',
          gap.file,
          60 + (gap.severity === 'high' ? 20 : gap.severity === 'medium' ? 10 : 0)
        )
        if (target) targets.push(target)
      }
    }

    // Sort by priority
    targets.sort((a, b) => b.priority - a.priority)

    return targets.slice(0, 10) // Limit to top 10 targets per area
  }

  /**
   * Create a question target for a specific file/area
   */
  private async createQuestionTarget(
    area: CodeArea,
    focus: QuestionTarget['focus'],
    filePath: string,
    priority: number
  ): Promise<QuestionTarget | null> {
    try {
      // Check if path exists and is a file (not a directory)
      if (!existsSync(filePath)) {
        console.warn(`File does not exist: ${filePath}`)
        return null
      }
      
      const stat = statSync(filePath)
      if (!stat.isFile()) {
        console.warn(`Path is not a file: ${filePath}`)
        return null
      }
      
      // Get file content (truncated)
      const fileArea = this.exploreCache.get(filePath) || await this.fileAnalyzer.analyzeFile(filePath)
      const fileContent = require('fs').readFileSync(filePath, 'utf-8')
      
      // Get git blame data
      const gitBlame = await this.gitAnalyzer.getBlameData(filePath)
      
      // Get recent changes
      const recentChanges = await this.gitAnalyzer.getRecentChanges([filePath], 7)
      
      // Find related files
      const relatedFiles = this.findRelatedFiles(filePath, area)

      return {
        area: fileArea,
        focus,
        context: {
          gitBlame,
          fileContent: fileContent.slice(0, this.config.questions.contextWindow),
          dependencies: fileArea.dependencies,
          recentChanges,
          relatedFiles
        },
        priority,
        estimatedTime: this.estimateQuestionTime(focus, fileArea.complexity)
      }
    } catch (error) {
      console.warn(`Failed to create question target for ${filePath}: ${error}`)
      return null
    }
  }

  /**
   * Detect architectural patterns in an area
   */
  private async detectAreaPatterns(area: CodeArea): Promise<ArchitecturalPattern[]> {
    if (area.type === 'file') {
      const content = require('fs').readFileSync(area.path, 'utf-8')
      return this.fileAnalyzer.detectPatterns(area.path, content)
    }

    // For directories, aggregate patterns from files
    const patterns: ArchitecturalPattern[] = []
    const files = this.getFilesInArea(area)
    
    for (const file of files.slice(0, 20)) { // Limit analysis to prevent performance issues
      try {
        const content = require('fs').readFileSync(file, 'utf-8')
        const filePatterns = this.fileAnalyzer.detectPatterns(file, content)
        patterns.push(...filePatterns)
      } catch {
        continue
      }
    }

    // Merge similar patterns
    return this.mergePatterns(patterns)
  }

  /**
   * Identify hot spots in the code
   */
  private async identifyHotSpots(area: CodeArea): Promise<any[]> {
    const hotSpots: any[] = []

    if (area.complexity > 30) {
      hotSpots.push({
        file: area.path,
        reason: 'high_complexity',
        score: area.complexity,
        details: `Complexity score: ${area.complexity}`
      })
    }

    if (area.changeFrequency > 5) {
      hotSpots.push({
        file: area.path,
        reason: 'frequent_changes',
        score: area.changeFrequency * 10,
        details: `${area.changeFrequency} changes in last 30 days`
      })
    }

    if (area.contributors.length > 5) {
      hotSpots.push({
        file: area.path,
        reason: 'many_contributors',
        score: area.contributors.length * 5,
        details: `${area.contributors.length} different contributors`
      })
    }

    if (area.linesOfCode && area.linesOfCode > 500) {
      hotSpots.push({
        file: area.path,
        reason: 'large_size',
        score: Math.min(area.linesOfCode / 10, 100),
        details: `${area.linesOfCode} lines of code`
      })
    }

    return hotSpots
  }

  /**
   * Find context gaps in the code
   */
  private async findContextGaps(area: CodeArea): Promise<any[]> {
    if (area.type === 'file') {
      const content = require('fs').readFileSync(area.path, 'utf-8')
      return this.fileAnalyzer.identifyContextGaps(area.path, content)
    }

    // For directories, analyze key files
    const gaps: any[] = []
    const files = this.getFilesInArea(area)
    
    for (const file of files.slice(0, 10)) {
      try {
        const content = require('fs').readFileSync(file, 'utf-8')
        const fileGaps = this.fileAnalyzer.identifyContextGaps(file, content)
        gaps.push(...fileGaps)
      } catch {
        continue
      }
    }

    return gaps
  }

  /**
   * Analyze dependencies for an area
   */
  private async analyzeDependencies(area: CodeArea): Promise<any[]> {
    const dependencies = area.dependencies.map(dep => ({
      name: dep,
      type: dep.startsWith('.') ? 'internal' : 'external',
      usageCount: 1,
      files: [area.path]
    }))

    return dependencies
  }

  /**
   * Helper methods
   */
  private shouldIgnore(path: string, ignorePatterns: string[]): boolean {
    return ignorePatterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'))
        return regex.test(path)
      }
      return path.includes(pattern)
    })
  }

  private detectLanguage(extension: string): string {
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
    }
    return languageMap[extension.toLowerCase()] || 'unknown'
  }

  private isTestFile(path: string): boolean {
    const lowerPath = path.toLowerCase()
    return lowerPath.includes('test') || 
           lowerPath.includes('spec') || 
           lowerPath.includes('__tests__') ||
           lowerPath.includes('.test.') ||
           lowerPath.includes('.spec.')
  }

  private calculatePriority(area: CodeArea): number {
    return area.complexity * 2 + area.changeFrequency * 10 + area.contributors.length
  }

  private estimateQuestionTime(focus: QuestionTarget['focus'], complexity: number): number {
    const baseTime = {
      'why': 2,
      'alternatives': 3,
      'tradeoffs': 4,
      'business': 2,
      'performance': 3,
      'security': 3,
      'architecture': 4
    }
    
    const complexityMultiplier = 1 + (complexity / 100)
    return Math.round(baseTime[focus] * complexityMultiplier)
  }

  private getFilesInArea(area: CodeArea): string[] {
    if (area.type === 'file') {
      return [area.path]
    }

    try {
      return readdirSync(area.path)
        .map(file => join(area.path, file))
        .filter(file => {
          try {
            return statSync(file).isFile()
          } catch {
            return false
          }
        })
    } catch {
      return []
    }
  }

  private findRelatedFiles(filePath: string, area: CodeArea): string[] {
    // Simple heuristic: files in the same directory
    const dir = require('path').dirname(filePath)
    const files = this.getFilesInArea({ ...area, path: dir, type: 'directory' })
    return files.filter(f => f !== filePath).slice(0, 5)
  }

  private mergePatterns(patterns: ArchitecturalPattern[]): ArchitecturalPattern[] {
    const merged = new Map<string, ArchitecturalPattern>()
    
    for (const pattern of patterns) {
      const key = pattern.type
      if (merged.has(key)) {
        const existing = merged.get(key)!
        existing.files.push(...pattern.files)
        existing.confidence = Math.max(existing.confidence, pattern.confidence)
      } else {
        merged.set(key, { ...pattern })
      }
    }
    
    return Array.from(merged.values())
  }
}