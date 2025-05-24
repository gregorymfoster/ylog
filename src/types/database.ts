/**
 * Database types for ylog SQLite storage
 */

import type { ResolvedYlogConfig } from './config.js';

/**
 * Complete PR record as stored in SQLite database
 */
export type PRRecord = {
  number: number;
  title: string;
  body: string | null;
  author: string;
  created_at: string;
  merged_at: string | null;
  base_branch: string;
  head_branch: string;
  url: string;
  additions: number;
  deletions: number;
  changed_files: number;
  why: string | null;
  business_impact: string | null;
  technical_changes: string | null;
  files_summary: string | null;
  llm_model: string | null;
  confidence_score: number | null;
  generated_at: string | null;
};

/**
 * File change record
 */
export type FileChange = {
  pr_number: number;
  file_path: string;
  additions: number;
  deletions: number;
  status: string;
  previous_filename: string | null;
};

/**
 * File context record for hybrid output
 */
export type FileContextRecord = {
  file_path: string;
  content: string;
  last_pr_number: number | null;
  pr_count: number;
  generated_at: string;
};

/**
 * AI-generated summary data
 */
export type AISummary = {
  why: string;
  business_impact: string;
  technical_changes: string;
  areas: string[];
  confidence_score?: number;
};

/**
 * Database query filters
 */
export type QueryFilters = {
  author?: string;
  areas?: string[];
  labels?: string[];
  since?: string; // ISO date
  until?: string; // ISO date
  limit?: number;
  offset?: number;
};

/**
 * Database query result
 */
export type QueryResult = {
  records: PRRecord[];
  total: number;
  hasMore: boolean;
};

/**
 * Processing context passed through pipeline
 */
export type ProcessingContext = {
  config: ResolvedYlogConfig;
  cacheDir: string;
  outputDir: string;
  startFromPR: number;
  database: any; // better-sqlite3 Database type
};