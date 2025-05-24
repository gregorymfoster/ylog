/**
 * GitHub CLI integration for fetching PR data
 */

import { execSync } from 'child_process';
import type { RawPR, RawPRList } from '../types/github.js';
import type { ResolvedYlogConfig } from '../types/config.js';

export class GitHubClient {
  private config: ResolvedYlogConfig;
  private requestCount = 0;
  private lastRequestTime = 0;

  constructor(config: ResolvedYlogConfig) {
    this.config = config;
  }

  /**
   * Check if gh CLI is available and authenticated
   */
  async checkAuth(): Promise<void> {
    try {
      execSync('gh auth status', { stdio: 'pipe' });
    } catch {
      throw new Error('GitHub CLI not authenticated. Run "gh auth login" first.');
    }
  }

  /**
   * Rate limiting based on config.github.throttleRpm
   */
  private async rateLimit(): Promise<void> {
    const minInterval = (60 * 1000) / this.config.github.throttleRpm; // ms between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Execute gh CLI command with error handling and rate limiting
   */
  private async execGH(command: string): Promise<string> {
    await this.rateLimit();
    
    try {
      const result = execSync(`gh ${command}`, {
        encoding: 'utf8',
        stdio: 'pipe',
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });
      return result.trim();
    } catch (error: any) {
      // Check for rate limiting
      if (error.message?.includes('rate limit')) {
        console.warn('GitHub rate limit hit, waiting 60 seconds...');
        await new Promise(resolve => setTimeout(resolve, 60000));
        return this.execGH(command); // Retry
      }
      
      // Check for network issues
      if (error.message?.includes('network') || error.message?.includes('timeout')) {
        console.warn('Network issue, retrying in 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        return this.execGH(command); // Retry once
      }
      
      throw new Error(`GitHub CLI error: ${error.message}`);
    }
  }

  /**
   * Fetch list of merged PRs with pagination
   */
  async fetchPRList(options: {
    limit?: number;
    since?: string; // ISO date string
    state?: 'open' | 'closed' | 'merged';
  } = {}): Promise<RawPRList> {
    const { limit = 100, since, state = 'merged' } = options;
    
    let command = `pr list --repo ${this.config.github.repo} --state ${state} --json number,title,author,createdAt,mergedAt,url --limit ${limit}`;
    
    if (since) {
      // gh CLI doesn't support since filter directly, we'll filter after fetching
      console.warn('Date filtering will be applied after fetching PRs');
    }

    const output = await this.execGH(command);
    const prs = JSON.parse(output) as Array<{
      number: number;
      title: string;
      author: { login: string };
      createdAt: string;
      mergedAt: string | null;
      url: string;
    }>;

    // Apply date filtering if specified
    let filteredPRs = prs;
    if (since) {
      const sinceDate = new Date(since);
      filteredPRs = prs.filter(pr => new Date(pr.createdAt) >= sinceDate);
    }

    return {
      prs: filteredPRs.map(pr => ({
        number: pr.number,
        title: pr.title,
        author: pr.author,
        createdAt: pr.createdAt,
        mergedAt: pr.mergedAt,
        url: pr.url,
      })),
      total: filteredPRs.length,
      hasMore: prs.length === limit, // Approximation
    };
  }

  /**
   * Fetch detailed PR information including files, reviews, etc.
   */
  async fetchPRDetails(prNumber: number): Promise<RawPR> {
    const command = `pr view ${prNumber} --repo ${this.config.github.repo} --json number,title,body,author,createdAt,mergedAt,baseRefName,headRefName,url,additions,deletions,changedFiles,files,reviews,labels`;
    
    const output = await this.execGH(command);
    const pr = JSON.parse(output);

    // Fetch file changes separately if not included
    let files = pr.files || [];
    if (!files.length && pr.changedFiles > 0) {
      try {
        const filesCommand = `pr diff ${prNumber} --repo ${this.config.github.repo} --name-only`;
        const filesOutput = await this.execGH(filesCommand);
        files = filesOutput.split('\n').filter(Boolean).map((path: string) => ({
          path,
          additions: 0,
          deletions: 0,
          status: 'modified',
          previous_filename: null,
        }));
      } catch {
        // File details not critical, continue without them
      }
    }

    return {
      number: pr.number,
      title: pr.title,
      body: pr.body || '',
      author: pr.author,
      createdAt: pr.createdAt,
      mergedAt: pr.mergedAt,
      baseRefName: pr.baseRefName,
      headRefName: pr.headRefName,
      url: pr.url,
      additions: pr.additions || 0,
      deletions: pr.deletions || 0,
      changedFiles: pr.changedFiles || files.length,
      files: files.map((file: any) => ({
        path: file.path,
        additions: file.additions || 0,
        deletions: file.deletions || 0,
        status: file.status || 'modified',
        previous_filename: file.previous_filename || null,
      })),
      reviews: (pr.reviews || []).map((review: any) => ({
        author: review.author?.login || 'unknown',
        state: review.state,
        submittedAt: review.submittedAt,
      })),
      labels: (pr.labels || []).map((label: any) => label.name),
    };
  }

  /**
   * Fetch PRs in batches with progress reporting
   */
  async *fetchPRsBatch(options: {
    batchSize?: number;
    since?: string;
    onProgress?: (processed: number, total: number) => void;
  } = {}): AsyncGenerator<RawPR[], void, unknown> {
    const { batchSize = 10, since, onProgress } = options;
    
    // First, get the list of PRs
    const prList = await this.fetchPRList({ since, limit: 1000 });
    const total = prList.prs.length;
    
    let processed = 0;
    
    for (let i = 0; i < prList.prs.length; i += batchSize) {
      const batch = prList.prs.slice(i, i + batchSize);
      const detailedPRs: RawPR[] = [];
      
      for (const prSummary of batch) {
        try {
          const prDetails = await this.fetchPRDetails(prSummary.number);
          detailedPRs.push(prDetails);
          processed++;
          
          if (onProgress) {
            onProgress(processed, total);
          }
        } catch (error) {
          console.warn(`Failed to fetch PR #${prSummary.number}: ${error}`);
          continue;
        }
      }
      
      if (detailedPRs.length > 0) {
        yield detailedPRs;
      }
    }
  }

  /**
   * Get repository information
   */
  async getRepoInfo(): Promise<{
    name: string;
    fullName: string;
    defaultBranch: string;
    description: string;
  }> {
    const command = `repo view ${this.config.github.repo} --json name,nameWithOwner,defaultBranchRef,description`;
    const output = await this.execGH(command);
    const repo = JSON.parse(output);
    
    return {
      name: repo.name,
      fullName: repo.nameWithOwner,
      defaultBranch: repo.defaultBranchRef?.name || 'main',
      description: repo.description || '',
    };
  }

  /**
   * Get request statistics
   */
  getStats(): { requestCount: number; lastRequestTime: number } {
    return {
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime,
    };
  }

  /**
   * Reset request statistics
   */
  resetStats(): void {
    this.requestCount = 0;
    this.lastRequestTime = 0;
  }
}