/**
 * GitHub-related types for ylog
 */

/**
 * Raw PR data from GitHub CLI
 */
export type RawPR = {
  number: number;
  title: string;
  body: string;
  author: { login: string };
  createdAt: string;
  mergedAt: string;
  files: Array<{ path: string; additions: number; deletions: number }>;
  comments: Array<{ body: string }>;
  patch: string; // Unified diff, truncated if > diffMaxBytes
  labels: Array<{ name: string }>;
  reviewers: Array<{ login: string }>;
  baseRefName: string; // base branch
  headRefName: string; // head branch
  closingIssuesReferences?: Array<{ number: number }>;
};

/**
 * GitHub metadata for caching and tracking
 */
export type GitHubMetadata = {
  repo: string; // owner/repo format
  lastFetched: string; // ISO timestamp
  rateLimit?: {
    remaining: number;
    resetAt: string;
  };
};

/**
 * GitHub CLI command result
 */
export type GhCliResult = 
  | { success: true; data: string }
  | { success: false; error: string; code?: number };

/**
 * PR list query options
 */
export type PRListOptions = {
  repo: string;
  state?: 'open' | 'closed' | 'merged' | 'all';
  limit?: number;
  since?: string; // ISO date
  author?: string;
  label?: string;
};

/**
 * Rate limiting state
 */
export type RateLimitState = {
  requestsRemaining: number;
  windowResetTime: number; // Unix timestamp
  requestsPerMinute: number;
};