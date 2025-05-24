/**
 * File analysis utilities for complexity, dependencies, and patterns
 */

import { readFileSync, statSync } from 'fs'
import { extname, dirname, basename } from 'path'
import { CodeArea, ArchitecturalPattern, CodeHotSpot, ContextGap } from '../types/core.js'

export class FileAnalyzer {
  
  /**
   * Analyze a file and create a CodeArea
   */
  async analyzeFile(filePath: string): Promise<CodeArea> {
    const stats = statSync(filePath)
    const content = readFileSync(filePath, 'utf-8')
    const ext = extname(filePath)
    
    return {
      path: filePath,
      type: 'file',
      complexity: this.calculateComplexity(content, ext),
      changeFrequency: 0, // Will be set by git analysis
      lastModified: stats.mtime,
      dependencies: this.extractDependencies(content, ext),
      contributors: [], // Will be set by git analysis
      linesOfCode: content.split('\n').length,
      language: this.detectLanguage(ext)
    }
  }

  /**
   * Analyze a directory and create a CodeArea
   */
  async analyzeDirectory(dirPath: string, files: string[]): Promise<CodeArea> {
    const stats = statSync(dirPath)
    
    // Aggregate metrics from files
    let totalComplexity = 0
    let totalLines = 0
    const allDependencies = new Set<string>()
    
    for (const file of files) {
      try {
        const fileArea = await this.analyzeFile(file)
        totalComplexity += fileArea.complexity
        totalLines += fileArea.linesOfCode || 0
        fileArea.dependencies.forEach(dep => allDependencies.add(dep))
      } catch {
        // Skip files that can't be analyzed
        continue
      }
    }

    return {
      path: dirPath,
      type: 'directory',
      complexity: files.length > 0 ? totalComplexity / files.length : 0,
      changeFrequency: 0, // Will be set by git analysis
      lastModified: stats.mtime,
      dependencies: Array.from(allDependencies),
      contributors: [], // Will be set by git analysis
      linesOfCode: totalLines
    }
  }

  /**
   * Calculate code complexity based on various metrics
   */
  private calculateComplexity(content: string, extension: string): number {
    let complexity = 0
    const lines = content.split('\n')
    
    // Base complexity from line count
    complexity += Math.log(lines.length + 1) * 2
    
    // Complexity from control structures
    const controlPatterns = [
      /\bif\s*\(/g, /\belse\b/g, /\bwhile\s*\(/g, /\bfor\s*\(/g,
      /\bswitch\s*\(/g, /\bcase\b/g, /\btry\b/g, /\bcatch\b/g,
      /\?\s*.*\s*:/g, // ternary operators
    ]
    
    for (const pattern of controlPatterns) {
      const matches = content.match(pattern)
      complexity += (matches?.length || 0) * 1.5
    }
    
    // Complexity from nesting (rough estimate)
    const nestingComplexity = this.calculateNestingComplexity(content)
    complexity += nestingComplexity
    
    // Language-specific adjustments
    if (['.ts', '.js', '.tsx', '.jsx'].includes(extension)) {
      // TypeScript/JavaScript specific patterns
      const asyncMatches = content.match(/\basync\b/g)
      complexity += (asyncMatches?.length || 0) * 0.5
      
      const promiseMatches = content.match(/\.then\(|\.catch\(/g)
      complexity += (promiseMatches?.length || 0) * 0.5
    }
    
    return Math.round(complexity)
  }

  /**
   * Estimate nesting complexity
   */
  private calculateNestingComplexity(content: string): number {
    let maxNesting = 0
    let currentNesting = 0
    let totalNesting = 0
    let nestingCount = 0
    
    for (const char of content) {
      if (char === '{') {
        currentNesting++
        maxNesting = Math.max(maxNesting, currentNesting)
      } else if (char === '}') {
        if (currentNesting > 0) {
          totalNesting += currentNesting
          nestingCount++
          currentNesting--
        }
      }
    }
    
    const avgNesting = nestingCount > 0 ? totalNesting / nestingCount : 0
    return maxNesting * 2 + avgNesting
  }

  /**
   * Extract dependencies from file content
   */
  private extractDependencies(content: string, extension: string): string[] {
    const dependencies: string[] = []
    
    // Import statements
    const importPatterns = [
      /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g, // ES6 imports
      /import\s+['"`]([^'"`]+)['"`]/g, // Side-effect imports
      /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g, // CommonJS requires
      /from\s+['"`]([^'"`]+)['"`]/g, // Python imports
      /#include\s*[<"]([^>"]+)[>"]/g, // C/C++ includes
    ]
    
    for (const pattern of importPatterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const dep = match[1]
        if (dep && !dep.startsWith('.')) { // External dependencies only
          dependencies.push(dep)
        }
      }
    }
    
    return [...new Set(dependencies)] // Remove duplicates
  }

  /**
   * Detect programming language from file extension
   */
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
      '.kt': 'kotlin',
      '.swift': 'swift',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.scala': 'scala',
      '.sh': 'shell',
      '.sql': 'sql',
      '.md': 'markdown',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.toml': 'toml',
      '.xml': 'xml',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass'
    }
    
    return languageMap[extension.toLowerCase()] || 'unknown'
  }

  /**
   * Identify architectural patterns in a file
   */
  detectPatterns(filePath: string, content: string): ArchitecturalPattern[] {
    const patterns: ArchitecturalPattern[] = []
    const fileName = basename(filePath)
    const dirName = dirname(filePath)
    
    // Component pattern (React, Vue, etc.)
    if (this.isComponent(content, fileName)) {
      patterns.push({
        type: 'component',
        confidence: 0.8,
        files: [filePath],
        description: 'UI component with props and rendering logic'
      })
    }
    
    // Service pattern
    if (this.isService(content, fileName)) {
      patterns.push({
        type: 'service',
        confidence: 0.7,
        files: [filePath],
        description: 'Service class with business logic or API calls'
      })
    }
    
    // Utility pattern
    if (this.isUtility(content, fileName)) {
      patterns.push({
        type: 'utility',
        confidence: 0.6,
        files: [filePath],
        description: 'Utility functions or helper methods'
      })
    }
    
    // Configuration pattern
    if (this.isConfig(content, fileName)) {
      patterns.push({
        type: 'config',
        confidence: 0.9,
        files: [filePath],
        description: 'Configuration settings or constants'
      })
    }
    
    // Test pattern
    if (this.isTest(content, fileName, dirName)) {
      patterns.push({
        type: 'test',
        confidence: 0.95,
        files: [filePath],
        description: 'Test file with test cases or specs'
      })
    }
    
    return patterns
  }

  /**
   * Identify context gaps in code
   */
  identifyContextGaps(filePath: string, content: string): ContextGap[] {
    const gaps: ContextGap[] = []
    const lines = content.split('\n')
    
    // Look for complex functions without comments
    const functionRegex = /^[\s]*(?:function|const|let|var)[\s]+(\w+)[\s]*[=(]/
    const complexThreshold = 10 // lines
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const functionMatch = line.match(functionRegex)
      
      if (functionMatch) {
        // Check if function is complex (many lines or control structures)
        const functionEnd = this.findFunctionEnd(lines, i)
        const functionLength = functionEnd - i
        
        // Check for preceding comments
        const hasComment = i > 0 && (
          lines[i - 1].trim().startsWith('//') ||
          lines[i - 1].trim().startsWith('*') ||
          lines[i - 1].trim().startsWith('/*')
        )
        
        if (functionLength > complexThreshold && !hasComment) {
          gaps.push({
            file: filePath,
            lines: [i + 1, functionEnd + 1],
            reason: 'complex_logic',
            severity: functionLength > 20 ? 'high' : 'medium'
          })
        }
      }
    }
    
    return gaps
  }

  /**
   * Find the end of a function (rough estimate)
   */
  private findFunctionEnd(lines: string[], start: number): number {
    let braceCount = 0
    let inFunction = false
    
    for (let i = start; i < lines.length; i++) {
      const line = lines[i]
      
      for (const char of line) {
        if (char === '{') {
          braceCount++
          inFunction = true
        } else if (char === '}') {
          braceCount--
          if (inFunction && braceCount === 0) {
            return i
          }
        }
      }
    }
    
    return Math.min(start + 20, lines.length - 1) // Fallback
  }

  private isComponent(content: string, fileName: string): boolean {
    const componentIndicators = [
      /export\s+(?:default\s+)?(?:function|const)\s+[A-Z]\w*/,
      /React\.Component/,
      /extends\s+Component/,
      /return\s*\(/,
      /<[A-Z]\w*.*>/,
      /\.component\./,
    ]
    
    return componentIndicators.some(pattern => pattern.test(content)) ||
           fileName.includes('component') ||
           fileName.includes('Component')
  }

  private isService(content: string, fileName: string): boolean {
    const serviceIndicators = [
      /class\s+\w*Service/,
      /\.service\./,
      /api\./,
      /fetch\(/,
      /axios\./,
      /http\./,
      /async\s+\w+\s*\(/,
    ]
    
    return serviceIndicators.some(pattern => pattern.test(content)) ||
           fileName.includes('service') ||
           fileName.includes('api') ||
           fileName.includes('client')
  }

  private isUtility(content: string, fileName: string): boolean {
    const utilityIndicators = [
      /export\s+(?:function|const)\s+\w+/,
      /module\.exports/,
      /export\s+\{/,
    ]
    
    const hasClasses = /class\s+\w+/.test(content)
    const hasComponents = this.isComponent(content, fileName)
    
    return (utilityIndicators.some(pattern => pattern.test(content)) &&
            !hasClasses && !hasComponents) ||
           fileName.includes('util') ||
           fileName.includes('helper') ||
           fileName.includes('tool')
  }

  private isConfig(content: string, fileName: string): boolean {
    const configIndicators = [
      /export\s+(?:default\s+)?(?:const|let|var)\s+\w*[Cc]onfig/,
      /module\.exports\s*=/,
      /export\s+default\s+\{/,
    ]
    
    return configIndicators.some(pattern => pattern.test(content)) ||
           fileName.includes('config') ||
           fileName.includes('setting') ||
           fileName.includes('constant') ||
           fileName.endsWith('.config.js') ||
           fileName.endsWith('.config.ts')
  }

  private isTest(content: string, fileName: string, dirName: string): boolean {
    const testIndicators = [
      /describe\s*\(/,
      /it\s*\(/,
      /test\s*\(/,
      /expect\s*\(/,
      /assert\./,
      /beforeEach\s*\(/,
      /afterEach\s*\(/,
    ]
    
    return testIndicators.some(pattern => pattern.test(content)) ||
           fileName.includes('.test.') ||
           fileName.includes('.spec.') ||
           dirName.includes('test') ||
           dirName.includes('spec') ||
           dirName.includes('__tests__')
  }
}