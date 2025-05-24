/**
 * Git operations and analysis utilities for ylog2
 */

import { execSync } from 'child_process'
import { GitBlameData, GitBlameLine, RecentChange } from '../types/core.js'

export class GitAnalyzer {
  private repoRoot: string

  constructor(repoRoot?: string) {
    this.repoRoot = repoRoot || this.findGitRoot()
  }

  /**
   * Find the git repository root
   */
  private findGitRoot(): string {
    try {
      return execSync('git rev-parse --show-toplevel', { 
        encoding: 'utf-8', 
        cwd: process.cwd() 
      }).trim()
    } catch {
      throw new Error('Not in a git repository')
    }
  }

  /**
   * Get git blame data for a file
   */
  async getBlameData(filePath: string): Promise<GitBlameData> {
    try {
      const output = execSync(
        `git blame --porcelain "${filePath}"`,
        { encoding: 'utf-8', cwd: this.repoRoot }
      )

      const lines = this.parseBlameOutput(output, filePath)
      return { file: filePath, lines }
    } catch (error) {
      throw new Error(`Failed to get blame data for ${filePath}: ${error}`)
    }
  }

  /**
   * Parse git blame porcelain output
   */
  private parseBlameOutput(output: string, filePath: string): GitBlameLine[] {
    const lines: GitBlameLine[] = []
    const outputLines = output.split('\n')
    let currentCommit: string = ''
    let currentAuthor: string = ''
    let currentDate: Date = new Date()
    let lineNumber = 1

    for (let i = 0; i < outputLines.length; i++) {
      const line = outputLines[i]

      if (line.match(/^[a-f0-9]{40}/)) {
        // New commit hash
        currentCommit = line.split(' ')[0]
      } else if (line.startsWith('author ')) {
        currentAuthor = line.substring(7)
      } else if (line.startsWith('author-time ')) {
        const timestamp = parseInt(line.substring(12))
        currentDate = new Date(timestamp * 1000)
      } else if (line.startsWith('\t')) {
        // This is the actual code line
        const content = line.substring(1)
        lines.push({
          lineNumber,
          author: currentAuthor,
          date: currentDate,
          commit: currentCommit,
          content
        })
        lineNumber++
      }
    }

    return lines
  }

  /**
   * Get recent changes for files
   */
  async getRecentChanges(filePaths: string[], days: number = 30): Promise<RecentChange[]> {
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().split('T')[0]

    const changes: RecentChange[] = []

    for (const filePath of filePaths) {
      try {
        const output = execSync(
          `git log --since="${sinceStr}" --pretty=format:"%H|%an|%ai|%s" --numstat -- "${filePath}"`,
          { encoding: 'utf-8', cwd: this.repoRoot }
        )

        const fileChanges = this.parseLogOutput(output, filePath)
        changes.push(...fileChanges)
      } catch {
        // File might not exist in git history, skip
        continue
      }
    }

    return changes.sort((a, b) => b.date.getTime() - a.date.getTime())
  }

  /**
   * Parse git log output
   */
  private parseLogOutput(output: string, filePath: string): RecentChange[] {
    if (!output.trim()) return []

    const changes: RecentChange[] = []
    const entries = output.split('\n\n')

    for (const entry of entries) {
      const lines = entry.trim().split('\n')
      if (lines.length < 2) continue

      const [commitInfo, ...statLines] = lines
      const [hash, author, dateStr, ...summaryParts] = commitInfo.split('|')
      const summary = summaryParts.join('|')

      // Find the stat line for our file
      let linesChanged = 0
      for (const statLine of statLines) {
        const [additions, deletions, file] = statLine.split('\t')
        if (file === filePath) {
          linesChanged = (parseInt(additions) || 0) + (parseInt(deletions) || 0)
          break
        }
      }

      changes.push({
        file: filePath,
        author,
        date: new Date(dateStr),
        summary,
        linesChanged
      })
    }

    return changes
  }

  /**
   * Get file contributors and their contribution frequency
   */
  async getContributors(filePath: string): Promise<string[]> {
    try {
      const output = execSync(
        `git log --pretty=format:"%an" -- "${filePath}" | sort | uniq -c | sort -nr`,
        { encoding: 'utf-8', cwd: this.repoRoot }
      )

      return output
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.trim().replace(/^\d+\s+/, ''))
    } catch {
      return []
    }
  }

  /**
   * Get files changed in recent commits
   */
  async getRecentlyChangedFiles(days: number = 30): Promise<string[]> {
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().split('T')[0]

    try {
      const output = execSync(
        `git log --since="${sinceStr}" --name-only --pretty=format: | sort | uniq`,
        { encoding: 'utf-8', cwd: this.repoRoot }
      )

      return output
        .split('\n')
        .filter(line => line.trim())
        .filter(line => !line.startsWith('.git/'))
    } catch {
      return []
    }
  }

  /**
   * Check if a file is tracked by git
   */
  isTracked(filePath: string): boolean {
    try {
      execSync(`git ls-files --error-unmatch "${filePath}"`, {
        cwd: this.repoRoot,
        stdio: 'ignore'
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * Get the current git repository remote URL
   */
  getRemoteUrl(): string | null {
    try {
      return execSync('git remote get-url origin', {
        encoding: 'utf-8',
        cwd: this.repoRoot
      }).trim()
    } catch {
      return null
    }
  }

  /**
   * Get current branch name
   */
  getCurrentBranch(): string {
    try {
      return execSync('git branch --show-current', {
        encoding: 'utf-8',
        cwd: this.repoRoot
      }).trim()
    } catch {
      return 'main'
    }
  }
}