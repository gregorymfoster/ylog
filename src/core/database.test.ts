import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { rmSync, existsSync } from 'fs';
import { YlogDatabase } from './database.js';
import type { PRRecord, FileChange } from '../types/database.js';

describe('YlogDatabase', () => {
  let db: YlogDatabase;
  let testDbPath: string;

  beforeEach(() => {
    testDbPath = join(process.cwd(), '.test', 'test.sqlite');
    db = new YlogDatabase(testDbPath);
  });

  afterEach(() => {
    db.close();
    if (existsSync(testDbPath)) {
      rmSync(testDbPath, { force: true });
    }
    if (existsSync(join(process.cwd(), '.test'))) {
      rmSync(join(process.cwd(), '.test'), { recursive: true, force: true });
    }
  });

  it('should initialize database with schema', () => {
    // Check that tables exist by querying sqlite_master
    const tables = db.getDB().prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all() as Array<{ name: string }>;

    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('prs');
    expect(tableNames).toContain('file_changes');
    expect(tableNames).toContain('file_contexts');
    expect(tableNames).toContain('pr_labels');
    expect(tableNames).toContain('pr_reviewers');
  });

  it('should insert and retrieve PR records', () => {
    const pr: PRRecord = {
      number: 123,
      title: 'Test PR',
      body: 'Test description',
      author: 'testuser',
      created_at: '2024-01-01T00:00:00Z',
      merged_at: '2024-01-02T00:00:00Z',
      base_branch: 'main',
      head_branch: 'feature/test',
      url: 'https://github.com/test/repo/pull/123',
      additions: 10,
      deletions: 5,
      changed_files: 2,
      why: 'Test implementation',
      business_impact: 'Improves testing',
      technical_changes: 'Adds test functionality',
      files_summary: 'Modified test files',
      llm_model: 'test-model',
      confidence_score: 0.9,
      generated_at: '2024-01-02T01:00:00Z'
    };

    db.insertPR(pr);
    const retrieved = db.getPR(123);

    expect(retrieved).toBeDefined();
    expect(retrieved?.number).toBe(123);
    expect(retrieved?.title).toBe('Test PR');
    expect(retrieved?.author).toBe('testuser');
  });

  it('should insert and retrieve file changes', () => {
    // First insert a PR
    const pr: PRRecord = {
      number: 124,
      title: 'File change test',
      body: '',
      author: 'testuser',
      created_at: '2024-01-01T00:00:00Z',
      merged_at: '2024-01-02T00:00:00Z',
      base_branch: 'main',
      head_branch: 'feature/files',
      url: 'https://github.com/test/repo/pull/124',
      additions: 20,
      deletions: 10,
      changed_files: 3,
      why: null,
      business_impact: null,
      technical_changes: null,
      files_summary: null,
      llm_model: null,
      confidence_score: null,
      generated_at: null
    };

    db.insertPR(pr);

    const files: FileChange[] = [
      {
        pr_number: 124,
        file_path: 'src/test.ts',
        additions: 15,
        deletions: 5,
        status: 'modified',
        previous_filename: null
      },
      {
        pr_number: 124,
        file_path: 'src/new.ts',
        additions: 5,
        deletions: 0,
        status: 'added',
        previous_filename: null
      }
    ];

    db.insertFileChanges(124, files);
    const retrieved = db.getFileChanges(124);

    expect(retrieved).toHaveLength(2);
    expect(retrieved[0].file_path).toBe('src/new.ts'); // Alphabetical order
    expect(retrieved[1].file_path).toBe('src/test.ts');
    expect(retrieved[1].status).toBe('modified');
  });

  it('should filter PRs by author', () => {
    const pr1: PRRecord = {
      number: 1,
      title: 'PR by Alice',
      body: '',
      author: 'alice',
      created_at: '2024-01-01T00:00:00Z',
      merged_at: '2024-01-02T00:00:00Z',
      base_branch: 'main',
      head_branch: 'feature/1',
      url: 'https://github.com/test/repo/pull/1',
      additions: 10,
      deletions: 5,
      changed_files: 1,
      why: null,
      business_impact: null,
      technical_changes: null,
      files_summary: null,
      llm_model: null,
      confidence_score: null,
      generated_at: null
    };

    const pr2: PRRecord = {
      number: 2,
      title: 'PR by Bob',
      body: '',
      author: 'bob',
      created_at: '2024-01-03T00:00:00Z',
      merged_at: '2024-01-04T00:00:00Z',
      base_branch: 'main',
      head_branch: 'feature/2',
      url: 'https://github.com/test/repo/pull/2',
      additions: 15,
      deletions: 3,
      changed_files: 2,
      why: null,
      business_impact: null,
      technical_changes: null,
      files_summary: null,
      llm_model: null,
      confidence_score: null,
      generated_at: null
    };

    db.insertPR(pr1);
    db.insertPR(pr2);

    const alicePRs = db.getPRs({ author: 'alice' });
    const bobPRs = db.getPRs({ author: 'bob' });

    expect(alicePRs).toHaveLength(1);
    expect(alicePRs[0].number).toBe(1);
    expect(bobPRs).toHaveLength(1);
    expect(bobPRs[0].number).toBe(2);
  });

  it('should get database statistics', () => {
    const pr: PRRecord = {
      number: 100,
      title: 'Stats test',
      body: '',
      author: 'stats-user',
      created_at: '2024-01-01T00:00:00Z',
      merged_at: '2024-01-02T00:00:00Z',
      base_branch: 'main',
      head_branch: 'feature/stats',
      url: 'https://github.com/test/repo/pull/100',
      additions: 5,
      deletions: 2,
      changed_files: 1,
      why: null,
      business_impact: null,
      technical_changes: null,
      files_summary: null,
      llm_model: null,
      confidence_score: null,
      generated_at: null
    };

    db.insertPR(pr);
    
    const files: FileChange[] = [
      {
        pr_number: 100,
        file_path: 'stats.ts',
        additions: 5,
        deletions: 2,
        status: 'modified',
        previous_filename: null
      }
    ];
    
    db.insertFileChanges(100, files);

    const stats = db.getStats();
    expect(stats.totalPRs).toBe(1);
    expect(stats.totalFiles).toBe(1);
    expect(stats.topAuthors).toHaveLength(1);
    expect(stats.topAuthors[0].author).toBe('stats-user');
    expect(stats.topAuthors[0].count).toBe(1);
  });
});