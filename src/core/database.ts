/**
 * SQLite database management and operations
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { PRRecord, FileChange, FileContextRecord } from '../types/database.js';

export class YlogDatabase {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    
    // Ensure directory exists
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initializeSchema();
  }

  private initializeSchema(): void {
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // PRs table - main PR metadata and AI-generated content
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS prs (
        number INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT,
        author TEXT NOT NULL,
        created_at TEXT NOT NULL,
        merged_at TEXT,
        base_branch TEXT NOT NULL,
        head_branch TEXT NOT NULL,
        url TEXT NOT NULL,
        additions INTEGER NOT NULL DEFAULT 0,
        deletions INTEGER NOT NULL DEFAULT 0,
        changed_files INTEGER NOT NULL DEFAULT 0,
        why TEXT,
        business_impact TEXT,
        technical_changes TEXT,
        files_summary TEXT,
        llm_model TEXT,
        confidence_score REAL,
        generated_at TEXT,
        synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at_db TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // File changes table - track which files were modified in each PR
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pr_number INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        additions INTEGER NOT NULL DEFAULT 0,
        deletions INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL, -- 'added', 'modified', 'deleted', 'renamed'
        previous_filename TEXT,
        FOREIGN KEY (pr_number) REFERENCES prs (number) ON DELETE CASCADE,
        UNIQUE(pr_number, file_path)
      )
    `);

    // File context table - generated .ylog files for hybrid output
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_contexts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        last_pr_number INTEGER,
        pr_count INTEGER NOT NULL DEFAULT 0,
        generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (last_pr_number) REFERENCES prs (number)
      )
    `);

    // PR labels table - for filtering and categorization
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pr_labels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pr_number INTEGER NOT NULL,
        label TEXT NOT NULL,
        FOREIGN KEY (pr_number) REFERENCES prs (number) ON DELETE CASCADE,
        UNIQUE(pr_number, label)
      )
    `);

    // PR reviewers table - track who reviewed what
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pr_reviewers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pr_number INTEGER NOT NULL,
        reviewer TEXT NOT NULL,
        state TEXT NOT NULL, -- 'APPROVED', 'CHANGES_REQUESTED', 'COMMENTED'
        FOREIGN KEY (pr_number) REFERENCES prs (number) ON DELETE CASCADE,
        UNIQUE(pr_number, reviewer)
      )
    `);

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_prs_author ON prs (author);
      CREATE INDEX IF NOT EXISTS idx_prs_created_at ON prs (created_at);
      CREATE INDEX IF NOT EXISTS idx_prs_merged_at ON prs (merged_at);
      CREATE INDEX IF NOT EXISTS idx_file_changes_path ON file_changes (file_path);
      CREATE INDEX IF NOT EXISTS idx_file_changes_pr ON file_changes (pr_number);
      CREATE INDEX IF NOT EXISTS idx_pr_labels_label ON pr_labels (label);
      CREATE INDEX IF NOT EXISTS idx_pr_reviewers_reviewer ON pr_reviewers (reviewer);
    `);
  }

  /**
   * Insert or update a PR record
   */
  insertPR(pr: PRRecord): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO prs (
        number, title, body, author, created_at, merged_at, base_branch, head_branch,
        url, additions, deletions, changed_files, why, business_impact, 
        technical_changes, files_summary, llm_model, confidence_score, generated_at, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      pr.number, pr.title, pr.body, pr.author, pr.created_at, pr.merged_at,
      pr.base_branch, pr.head_branch, pr.url, pr.additions, pr.deletions,
      pr.changed_files, pr.why, pr.business_impact, pr.technical_changes,
      pr.files_summary, pr.llm_model, pr.confidence_score, pr.generated_at,
      new Date().toISOString()
    );
  }

  /**
   * Insert file changes for a PR
   */
  insertFileChanges(prNumber: number, files: FileChange[]): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO file_changes (
        pr_number, file_path, additions, deletions, status, previous_filename
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      for (const file of files) {
        stmt.run(prNumber, file.file_path, file.additions, file.deletions, file.status, file.previous_filename);
      }
    });

    transaction();
  }

  /**
   * Get PR by number
   */
  getPR(number: number): PRRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM prs WHERE number = ?');
    return stmt.get(number) as PRRecord | undefined;
  }

  /**
   * Get PRs with optional filters
   */
  getPRs(filters: {
    author?: string;
    since?: string;
    until?: string;
    file?: string;
    limit?: number;
    offset?: number;
  } = {}): PRRecord[] {
    let query = 'SELECT * FROM prs WHERE 1=1';
    const params: any[] = [];

    if (filters.author) {
      query += ' AND author = ?';
      params.push(filters.author);
    }

    if (filters.since) {
      query += ' AND created_at >= ?';
      params.push(filters.since);
    }

    if (filters.until) {
      query += ' AND created_at <= ?';
      params.push(filters.until);
    }

    if (filters.file) {
      query += ` AND number IN (
        SELECT pr_number FROM file_changes WHERE file_path = ?
      )`;
      params.push(filters.file);
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
      
      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as PRRecord[];
  }

  /**
   * Get file changes for a PR
   */
  getFileChanges(prNumber: number): FileChange[] {
    const stmt = this.db.prepare('SELECT * FROM file_changes WHERE pr_number = ? ORDER BY file_path');
    return stmt.all(prNumber) as FileChange[];
  }

  /**
   * Insert or update file context record
   */
  insertFileContext(context: FileContextRecord): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO file_contexts (
        file_path, content, last_pr_number, pr_count, generated_at
      ) VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      context.file_path,
      context.content, 
      context.last_pr_number,
      context.pr_count,
      new Date().toISOString()
    );
  }

  /**
   * Get file context record
   */
  getFileContext(filePath: string): FileContextRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM file_contexts WHERE file_path = ?');
    return stmt.get(filePath) as FileContextRecord | undefined;
  }

  /**
   * Get PRs with file information for context generation
   */
  getPRsForContext(): Array<{
    number: number;
    title: string;
    body: string | null;
    author: string;
    createdAt: string;
    mergedAt: string | null;
    baseRefName: string;
    headRefName: string;
    url: string;
    additions: number;
    deletions: number;
    changedFiles: number;
    files: Array<{
      path: string;
      additions: number;
      deletions: number;
      status: string;
      previous_filename: string | null;
    }>;
    summary?: {
      why: string;
      business_impact: string;
      technical_changes: string[];
      areas: string[];
      confidence_score: number;
    };
    labels: string[];
  }> {
    // Get all PRs
    const prs = this.db.prepare(`
      SELECT 
        number, title, body, author, created_at, merged_at, 
        base_branch, head_branch, url, additions, deletions, changed_files,
        why, business_impact, technical_changes, files_summary,
        llm_model, confidence_score, generated_at
      FROM prs 
      ORDER BY merged_at DESC, created_at DESC
    `).all();

    return prs.map((pr: any) => {
      // Get files for this PR
      const files = this.db.prepare('SELECT * FROM file_changes WHERE pr_number = ?').all(pr.number);
      
      return {
        number: pr.number,
        title: pr.title,
        body: pr.body,
        author: pr.author,
        createdAt: pr.created_at,
        mergedAt: pr.merged_at,
        baseRefName: pr.base_branch,
        headRefName: pr.head_branch,
        url: pr.url,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changed_files,
        files: files.map((file: any) => ({
          path: file.file_path,
          additions: file.additions,
          deletions: file.deletions,
          status: file.status,
          previous_filename: file.previous_filename
        })),
        summary: pr.why ? {
          why: pr.why,
          business_impact: pr.business_impact || '',
          technical_changes: pr.technical_changes ? JSON.parse(pr.technical_changes) : [],
          areas: [], // Will be populated from technical_changes if needed
          confidence_score: pr.confidence_score || 0.8
        } : undefined,
        labels: [] // Labels are stored as JSON in the current schema but we'll skip for now
      };
    });
  }

  /**
   * Get database statistics
   */
  getStats(): {
    totalPRs: number;
    totalFiles: number;
    oldestPR: string | null;
    newestPR: string | null;
    topAuthors: Array<{ author: string; count: number }>;
  } {
    const totalPRs = this.db.prepare('SELECT COUNT(*) as count FROM prs').get() as { count: number };
    const totalFiles = this.db.prepare('SELECT COUNT(DISTINCT file_path) as count FROM file_changes').get() as { count: number };
    const oldestPR = this.db.prepare('SELECT MIN(created_at) as date FROM prs').get() as { date: string | null };
    const newestPR = this.db.prepare('SELECT MAX(created_at) as date FROM prs').get() as { date: string | null };
    const topAuthors = this.db.prepare(`
      SELECT author, COUNT(*) as count 
      FROM prs 
      GROUP BY author 
      ORDER BY count DESC 
      LIMIT 10
    `).all() as Array<{ author: string; count: number }>;

    return {
      totalPRs: totalPRs.count,
      totalFiles: totalFiles.count,
      oldestPR: oldestPR.date,
      newestPR: newestPR.date,
      topAuthors
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get the underlying database instance (for advanced operations)
   */
  getDB(): Database.Database {
    return this.db;
  }
}