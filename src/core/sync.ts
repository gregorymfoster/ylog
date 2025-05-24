/**
 * Main synchronization orchestrator that coordinates GitHub data fetching,
 * AI processing, and database storage
 */

import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { GitHubClient } from './github.js';
import { AIClient } from './ai.js';
import { YlogDatabase } from './database.js';
import type { ResolvedYlogConfig } from '../types/config.js';
import type { RawPR } from '../types/github.js';
import type { PRRecord, FileChange, AISummary } from '../types/database.js';

export interface SyncOptions {
  since?: string; // ISO date string
  dryRun?: boolean;
  force?: boolean; // Re-process existing PRs
  prNumbers?: number[]; // Specific PRs to process
  skipAI?: boolean; // Skip AI processing (useful for testing)
}

export interface SyncProgress {
  phase: 'fetching' | 'processing' | 'storing' | 'complete';
  totalPRs: number;
  processedPRs: number;
  currentPR?: number;
  errors: Array<{ pr?: number; error: string }>;
  skipped: number;
  updated: number;
  created: number;
}

export class SyncOrchestrator {
  private config: ResolvedYlogConfig;
  private github: GitHubClient;
  private ai: AIClient;
  private db: YlogDatabase;
  private progress: SyncProgress;

  constructor(config: ResolvedYlogConfig) {
    this.config = config;
    this.github = new GitHubClient(config);
    this.ai = new AIClient(config);
    
    // Initialize database
    const dbPath = join(config.outputDir, 'prs.db');
    this.ensureDirectoryExists(config.outputDir);
    this.db = new YlogDatabase(dbPath);

    this.progress = {
      phase: 'fetching',
      totalPRs: 0,
      processedPRs: 0,
      errors: [],
      skipped: 0,
      updated: 0,
      created: 0,
    };
  }

  /**
   * Main sync operation
   */
  async sync(
    options: SyncOptions = {},
    onProgress?: (progress: SyncProgress) => void
  ): Promise<SyncProgress> {
    const { since, dryRun = false, force = false, prNumbers, skipAI = false } = options;

    try {
      // Reset progress
      this.resetProgress();
      
      // Phase 1: Check prerequisites
      await this.checkPrerequisites();
      
      // Phase 2: Fetch PR data from GitHub
      this.progress.phase = 'fetching';
      onProgress?.(this.progress);

      const prs = await this.fetchPRs(since, prNumbers);
      this.progress.totalPRs = prs.length;
      onProgress?.(this.progress);

      if (prs.length === 0) {
        this.progress.phase = 'complete';
        onProgress?.(this.progress);
        return this.progress;
      }

      // Phase 3: Process PRs (AI + Database)
      this.progress.phase = 'processing';
      onProgress?.(this.progress);

      await this.processPRs(prs, { dryRun, force, skipAI, onProgress });

      // Phase 4: Generate context files if enabled
      if (this.config.generateContextFiles && !dryRun) {
        await this.generateContextFiles();
      }

      this.progress.phase = 'complete';
      onProgress?.(this.progress);

      return this.progress;
    } catch (error) {
      this.progress.errors.push({ error: `Sync failed: ${error}` });
      throw error;
    } finally {
      // Always close database connection
      this.db.close();
    }
  }

  /**
   * Check that all prerequisites are met
   */
  private async checkPrerequisites(): Promise<void> {
    // Check GitHub CLI authentication
    await this.github.checkAuth();

    // Test AI connection if not skipping AI
    const aiTest = await this.ai.testConnection();
    if (!aiTest.success) {
      throw new Error(`AI connection failed: ${aiTest.error}`);
    }

    // Ensure output directory exists
    this.ensureDirectoryExists(this.config.outputDir);
    this.ensureDirectoryExists(this.config.cacheDir);
  }

  /**
   * Fetch PRs from GitHub
   */
  private async fetchPRs(since?: string, prNumbers?: number[]): Promise<RawPR[]> {
    if (prNumbers && prNumbers.length > 0) {
      // Fetch specific PRs
      const prs: RawPR[] = [];
      for (const prNumber of prNumbers) {
        try {
          const pr = await this.github.fetchPRDetails(prNumber);
          prs.push(pr);
        } catch (error) {
          this.progress.errors.push({
            pr: prNumber,
            error: `Failed to fetch PR #${prNumber}: ${error}`,
          });
        }
      }
      return prs;
    } else {
      // Fetch all PRs with optional date filter
      const allPRs: RawPR[] = [];
      
      for await (const batch of this.github.fetchPRsBatch({
        batchSize: 10,
        since,
        onProgress: (processed, total) => {
          // Update progress for PR fetching
          this.progress.processedPRs = processed;
          this.progress.totalPRs = total;
        },
      })) {
        allPRs.push(...batch);
      }

      return allPRs;
    }
  }

  /**
   * Process PRs through AI and store in database
   */
  private async processPRs(
    prs: RawPR[],
    options: {
      dryRun: boolean;
      force: boolean;
      skipAI: boolean;
      onProgress?: (progress: SyncProgress) => void;
    }
  ): Promise<void> {
    const { dryRun, force, skipAI, onProgress } = options;

    for (const pr of prs) {
      try {
        this.progress.currentPR = pr.number;
        onProgress?.(this.progress);

        // Check if PR already exists
        const existingPR = this.db.getPR(pr.number);
        if (existingPR && !force) {
          this.progress.skipped++;
          this.progress.processedPRs++;
          continue;
        }

        // Convert RawPR to PRRecord
        let aiSummary: AISummary | null = null;
        
        if (!skipAI) {
          try {
            aiSummary = await this.ai.summarizePR(pr);
          } catch (error) {
            this.progress.errors.push({
              pr: pr.number,
              error: `AI processing failed: ${error}`,
            });
            // Continue without AI summary
          }
        }

        const prRecord: PRRecord = {
          number: pr.number,
          title: pr.title,
          body: pr.body,
          author: pr.author.login,
          created_at: pr.createdAt,
          merged_at: pr.mergedAt,
          base_branch: pr.baseRefName,
          head_branch: pr.headRefName,
          url: pr.url,
          additions: pr.additions,
          deletions: pr.deletions,
          changed_files: pr.changedFiles,
          why: aiSummary?.why || null,
          business_impact: aiSummary?.business_impact || null,
          technical_changes: aiSummary?.technical_changes || null,
          files_summary: this.createFilesSummary(pr.files),
          llm_model: aiSummary ? `${this.config.ai.provider}/${this.config.ai.model}` : null,
          confidence_score: aiSummary?.confidence_score || null,
          generated_at: aiSummary ? new Date().toISOString() : null,
        };

        const fileChanges: FileChange[] = pr.files.map(file => ({
          pr_number: pr.number,
          file_path: file.path,
          additions: file.additions,
          deletions: file.deletions,
          status: file.status,
          previous_filename: file.previous_filename,
        }));

        if (!dryRun) {
          // Store in database
          this.db.insertPR(prRecord);
          this.db.insertFileChanges(pr.number, fileChanges);

          if (existingPR) {
            this.progress.updated++;
          } else {
            this.progress.created++;
          }
        }

        this.progress.processedPRs++;
        onProgress?.(this.progress);

      } catch (error) {
        this.progress.errors.push({
          pr: pr.number,
          error: `Processing failed: ${error}`,
        });
        this.progress.processedPRs++;
        onProgress?.(this.progress);
      }
    }
  }

  /**
   * Generate context files for the hybrid output strategy
   */
  private async generateContextFiles(): Promise<void> {
    // This would implement the .ylog file generation
    // For now, just a placeholder
    console.log('Context file generation not yet implemented');
  }

  /**
   * Create a summary of file changes
   */
  private createFilesSummary(files: RawPR['files']): string {
    if (files.length === 0) return 'No files changed';

    const summary = files
      .slice(0, 10) // Limit to first 10 files
      .map(f => `${f.path} (+${f.additions}/-${f.deletions})`)
      .join(', ');

    if (files.length > 10) {
      return `${summary}, and ${files.length - 10} more files`;
    }

    return summary;
  }

  /**
   * Reset progress tracking
   */
  private resetProgress(): void {
    this.progress = {
      phase: 'fetching',
      totalPRs: 0,
      processedPRs: 0,
      errors: [],
      skipped: 0,
      updated: 0,
      created: 0,
    };
  }

  /**
   * Ensure directory exists
   */
  private ensureDirectoryExists(path: string): void {
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }
  }

  /**
   * Get current progress
   */
  getProgress(): SyncProgress {
    return { ...this.progress };
  }

  /**
   * Get database statistics
   */
  getDatabaseStats() {
    return this.db.getStats();
  }

  /**
   * Test all connections and dependencies
   */
  async testConnections(): Promise<{
    github: boolean;
    ai: { success: boolean; provider: string; model: string; error?: string };
    database: boolean;
  }> {
    const results: {
      github: boolean;
      ai: { success: boolean; provider: string; model: string; error?: string };
      database: boolean;
    } = {
      github: false,
      ai: { success: false, provider: '', model: '', error: undefined },
      database: false,
    };

    // Test GitHub
    try {
      await this.github.checkAuth();
      results.github = true;
    } catch {
      results.github = false;
    }

    // Test AI
    results.ai = await this.ai.testConnection();

    // Test database
    try {
      this.db.getStats();
      results.database = true;
    } catch {
      results.database = false;
    }

    return results;
  }

  /**
   * Clean up resources
   */
  close(): void {
    this.db.close();
  }
}