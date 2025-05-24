/**
 * GitHub API integration using Octokit
 */

import { Octokit } from '@octokit/rest';
import type { RawPR, RawPRList } from '../types/github.js';
import type { ResolvedYlogConfig } from '../types/config.js';

export class GitHubClient {
  private octokit: Octokit;
  private config: ResolvedYlogConfig;
  private owner: string;
  private repo: string;
  private requestCount = 0;

  constructor(config: ResolvedYlogConfig) {
    this.config = config;
    
    // Parse owner/repo from config
    const [owner, repo] = config.github.repo.split('/');
    if (!owner || !repo) {
      throw new Error(`Invalid repository format: ${config.github.repo}. Expected: owner/repo`);
    }
    this.owner = owner;
    this.repo = repo;

    // Initialize Octokit with token and rate limiting
    this.octokit = new Octokit({
      auth: config.github.token,
      throttle: {
        onRateLimit: (retryAfter: number, _options: any) => {
          console.warn(`Rate limit hit, retrying after ${retryAfter} seconds...`);
          return true; // Retry
        },
        onSecondaryRateLimit: (retryAfter: number, _options: any) => {
          console.warn(`Secondary rate limit hit, retrying after ${retryAfter} seconds...`);
          return true; // Retry
        },
      },
    });
  }

  /**
   * Check if authentication is working
   */
  async checkAuth(): Promise<void> {
    try {
      await this.octokit.rest.users.getAuthenticated();
    } catch (error: any) {
      throw new Error(`GitHub authentication failed: ${error.message}`);
    }
  }

  /**
   * Fetch list of PRs with pagination
   */
  async fetchPRList(options: {
    limit?: number;
    since?: string; // ISO date string
    state?: 'open' | 'closed' | 'all';
  } = {}): Promise<RawPRList> {
    const { limit = 100, since, state = 'closed' } = options;
    
    const prs: Array<{
      number: number;
      title: string;
      author: { login: string };
      createdAt: string;
      mergedAt: string | null;
      url: string;
    }> = [];

    // Use pagination to fetch all PRs
    const iterator = this.octokit.paginate.iterator(
      this.octokit.rest.pulls.list,
      {
        owner: this.owner,
        repo: this.repo,
        state,
        sort: 'created',
        direction: 'desc',
        per_page: Math.min(limit, 100),
      }
    );

    let fetched = 0;
    for await (const { data } of iterator) {
      for (const pr of data) {
        // Skip non-merged PRs if we want merged ones
        if (state === 'closed' && !pr.merged_at) continue;

        // Apply date filtering - skip PRs that are too old
        if (since && new Date(pr.created_at) < new Date(since)) {
          continue;
        }

        prs.push({
          number: pr.number,
          title: pr.title,
          author: { login: pr.user?.login || 'unknown' },
          createdAt: pr.created_at,
          mergedAt: pr.merged_at,
          url: pr.html_url,
        });

        fetched++;
        if (fetched >= limit) {
          return {
            prs,
            total: prs.length,
            hasMore: true,
          };
        }
      }
    }

    return {
      prs,
      total: prs.length,
      hasMore: false,
    };
  }

  /**
   * Fetch detailed PR information including files, reviews, etc.
   */
  async fetchPRDetails(prNumber: number): Promise<RawPR> {
    this.requestCount++;

    try {
      // Fetch PR details
      const { data: pr } = await this.octokit.rest.pulls.get({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
      });

      // Fetch PR files
      const { data: files } = await this.octokit.rest.pulls.listFiles({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
      });

      // Fetch PR reviews
      const { data: reviews } = await this.octokit.rest.pulls.listReviews({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
      });

      return {
        number: pr.number,
        title: pr.title,
        body: pr.body || '',
        author: { login: pr.user?.login || 'unknown' },
        createdAt: pr.created_at,
        mergedAt: pr.merged_at,
        baseRefName: pr.base.ref,
        headRefName: pr.head.ref,
        url: pr.html_url,
        additions: pr.additions || 0,
        deletions: pr.deletions || 0,
        changedFiles: pr.changed_files || files.length,
        files: files.map(file => ({
          path: file.filename,
          additions: file.additions,
          deletions: file.deletions,
          status: file.status as 'added' | 'removed' | 'modified' | 'renamed',
          previous_filename: file.previous_filename || null,
        })),
        reviews: reviews.map(review => ({
          author: review.user?.login || 'unknown',
          state: review.state as 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED',
          submittedAt: review.submitted_at || (review as any).updated_at,
        })),
        labels: pr.labels?.map(label => typeof label === 'string' ? label : label.name) || [],
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch PR #${prNumber}: ${error.message}`);
    }
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
      
      // Process batch concurrently but with controlled concurrency
      const promises = batch.map(async (prSummary) => {
        try {
          const prDetails = await this.fetchPRDetails(prSummary.number);
          processed++;
          
          if (onProgress) {
            onProgress(processed, total);
          }
          
          return prDetails;
        } catch (error) {
          console.warn(`Failed to fetch PR #${prSummary.number}: ${error}`);
          processed++;
          if (onProgress) {
            onProgress(processed, total);
          }
          return null;
        }
      });
      
      const results = await Promise.all(promises);
      const validPRs = results.filter((pr): pr is RawPR => pr !== null);
      
      if (validPRs.length > 0) {
        yield validPRs;
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
    const { data: repo } = await this.octokit.rest.repos.get({
      owner: this.owner,
      repo: this.repo,
    });
    
    return {
      name: repo.name,
      fullName: repo.full_name,
      defaultBranch: repo.default_branch,
      description: repo.description || '',
    };
  }

  /**
   * Get request statistics
   */
  getStats(): { requestCount: number; rateLimit?: any } {
    return {
      requestCount: this.requestCount,
    };
  }

  /**
   * Reset request statistics
   */
  resetStats(): void {
    this.requestCount = 0;
  }
}