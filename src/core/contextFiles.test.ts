import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { detectAreas, generateContextFiles, shouldGenerateFile, type PRContextRecord } from './contextFiles.js';
import type { ResolvedYlogConfig } from '../types/config.js';

describe('Context Files', () => {
  let testDir: string;
  let mockConfig: ResolvedYlogConfig;
  let mockPRs: PRContextRecord[];

  beforeEach(() => {
    testDir = join(process.cwd(), '.test-context');
    
    mockConfig = {
      github: {
        repo: 'owner/test-repo',
        token: 'ghp_test_token',
        throttleRpm: 100,
      },
      ai: {
        provider: 'ollama',
        model: 'test-model',
      },
      concurrency: 10,
      outputDir: '.ylog',
      generateContextFiles: true,
      contextFileThreshold: 3,
      historyMonths: 6,
      cacheDir: '.ylog/cache',
      diffMaxBytes: 1000000,
    };

    mockPRs = [
      {
        number: 1,
        title: 'Add authentication system',
        body: 'Implement JWT-based authentication',
        author: 'alice',
        createdAt: '2025-05-01T00:00:00Z',
        mergedAt: '2025-05-01T12:00:00Z',
        baseRefName: 'main',
        headRefName: 'feature/auth',
        url: 'https://github.com/owner/test-repo/pull/1',
        additions: 150,
        deletions: 10,
        changedFiles: 5,
        files: [
          { path: 'src/auth/login.ts', additions: 50, deletions: 0, status: 'added', previous_filename: null },
          { path: 'src/auth/middleware.ts', additions: 40, deletions: 0, status: 'added', previous_filename: null },
          { path: 'src/auth/types.ts', additions: 20, deletions: 0, status: 'added', previous_filename: null },
          { path: 'src/utils/jwt.ts', additions: 30, deletions: 5, status: 'modified', previous_filename: null },
          { path: 'tests/auth.test.ts', additions: 10, deletions: 5, status: 'added', previous_filename: null },
        ],
        summary: {
          why: 'Users need to authenticate to access protected resources',
          business_impact: 'Enables secure user access and data protection',
          technical_changes: ['JWT authentication', 'middleware implementation', 'type definitions'],
          areas: ['auth', 'utils'],
          confidence_score: 0.9,
        },
        labels: ['feature', 'auth'],
      },
      {
        number: 2,
        title: 'Fix authentication token refresh',
        body: 'Resolve issue with expired tokens',
        author: 'bob',
        createdAt: '2025-05-02T00:00:00Z',
        mergedAt: '2025-05-02T12:00:00Z',
        baseRefName: 'main',
        headRefName: 'fix/token-refresh',
        url: 'https://github.com/owner/test-repo/pull/2',
        additions: 25,
        deletions: 15,
        changedFiles: 2,
        files: [
          { path: 'src/auth/middleware.ts', additions: 20, deletions: 10, status: 'modified', previous_filename: null },
          { path: 'src/auth/login.ts', additions: 5, deletions: 5, status: 'modified', previous_filename: null },
        ],
        summary: {
          why: 'Token refresh was failing causing user logouts',
          business_impact: 'Improves user experience by preventing unexpected logouts',
          technical_changes: ['token refresh logic', 'error handling'],
          areas: ['auth'],
          confidence_score: 0.8,
        },
        labels: ['bug', 'auth'],
      },
      {
        number: 3,
        title: 'Add user profile management',
        body: 'Allow users to update their profiles',
        author: 'charlie',
        createdAt: '2025-05-03T00:00:00Z',
        mergedAt: '2025-05-03T12:00:00Z',
        baseRefName: 'main',
        headRefName: 'feature/profile',
        url: 'https://github.com/owner/test-repo/pull/3',
        additions: 80,
        deletions: 5,
        changedFiles: 4,
        files: [
          { path: 'src/auth/profile.ts', additions: 60, deletions: 0, status: 'added', previous_filename: null },
          { path: 'src/auth/middleware.ts', additions: 10, deletions: 5, status: 'modified', previous_filename: null },
          { path: 'src/utils/validation.ts', additions: 10, deletions: 0, status: 'added', previous_filename: null },
          { path: 'tests/profile.test.ts', additions: 0, deletions: 0, status: 'added', previous_filename: null },
        ],
        summary: {
          why: 'Users need to manage their profile information',
          business_impact: 'Enables personalized user experience',
          technical_changes: ['profile management', 'validation utilities'],
          areas: ['auth', 'utils'],
          confidence_score: 0.85,
        },
        labels: ['feature'],
      },
      {
        number: 4,
        title: 'Add logging system',
        body: 'Implement structured logging',
        author: 'alice',
        createdAt: '2025-05-04T00:00:00Z',
        mergedAt: '2025-05-04T12:00:00Z',
        baseRefName: 'main',
        headRefName: 'feature/logging',
        url: 'https://github.com/owner/test-repo/pull/4',
        additions: 40,
        deletions: 5,
        changedFiles: 2,
        files: [
          { path: 'src/utils/logger.ts', additions: 35, deletions: 0, status: 'added', previous_filename: null },
          { path: 'src/utils/index.ts', additions: 5, deletions: 5, status: 'modified', previous_filename: null },
        ],
        summary: {
          why: 'Application needs structured logging for debugging',
          business_impact: 'Improves application monitoring and debugging',
          technical_changes: ['structured logging', 'log levels'],
          areas: ['utils'],
          confidence_score: 0.9,
        },
        labels: ['feature', 'infrastructure'],
      },
    ];
  });

  afterEach(() => {
    // Clean up test files
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    
    // Clean up any .ylog files created in the current directory
    ['src', 'src/auth', 'src/utils', 'tests'].forEach(dir => {
      const ylogPath = join(dir, '.ylog');
      if (existsSync(ylogPath)) {
        rmSync(ylogPath, { force: true });
      }
    });
  });

  describe('detectAreas', () => {
    it('should detect code areas from file paths', () => {
      const areas = detectAreas(mockPRs);
      
      expect(areas.size).toBeGreaterThan(0);
      expect(areas.has('src')).toBe(true);
      expect(areas.has('src/auth')).toBe(true);
      expect(areas.has('src/utils')).toBe(true);
      expect(areas.has('tests')).toBe(true);
    });

    it('should group PRs by area correctly', () => {
      const areas = detectAreas(mockPRs);
      
      const authPRs = areas.get('src/auth');
      expect(authPRs).toBeDefined();
      expect(authPRs!.length).toBe(3); // PRs 1, 2, 3 affect src/auth
      
      const utilsPRs = areas.get('src/utils');
      expect(utilsPRs).toBeDefined();
      expect(utilsPRs!.length).toBe(3); // PRs 1, 3, 4 affect src/utils
    });

    it('should handle PRs without files', () => {
      const prsWithoutFiles = [
        {
          ...mockPRs[0],
          files: [],
        },
      ];
      
      const areas = detectAreas(prsWithoutFiles);
      expect(areas.size).toBe(0);
    });
  });

  describe('shouldGenerateFile', () => {
    it('should generate files for areas meeting threshold', () => {
      expect(shouldGenerateFile('src/auth', 3, mockConfig)).toBe(true);
      expect(shouldGenerateFile('src/utils', 4, mockConfig)).toBe(true);
    });

    it('should not generate files below threshold', () => {
      expect(shouldGenerateFile('src/auth', 2, mockConfig)).toBe(false);
      expect(shouldGenerateFile('src/utils', 1, mockConfig)).toBe(false);
    });

    it('should skip generic paths', () => {
      expect(shouldGenerateFile('src', 5, mockConfig)).toBe(false);
      expect(shouldGenerateFile('.', 10, mockConfig)).toBe(false);
    });

    it('should skip hidden directories', () => {
      expect(shouldGenerateFile('.github', 5, mockConfig)).toBe(false);
      expect(shouldGenerateFile('src/.hidden', 5, mockConfig)).toBe(false);
    });

    it('should skip build directories', () => {
      expect(shouldGenerateFile('node_modules', 10, mockConfig)).toBe(false);
      expect(shouldGenerateFile('dist', 5, mockConfig)).toBe(false);
      expect(shouldGenerateFile('build', 5, mockConfig)).toBe(false);
    });
  });

  describe('generateContextFiles', () => {
    it('should generate context files for qualifying areas', async () => {
      const result = await generateContextFiles(mockPRs, mockConfig);
      
      expect(result.generated).toBeGreaterThan(0);
      expect(result.skipped).toBeGreaterThanOrEqual(0);
      
      // Check that files were actually created
      expect(existsSync('src/auth/.ylog')).toBe(true);
      expect(existsSync('src/utils/.ylog')).toBe(true);
    });

    it('should not generate files when disabled in config', async () => {
      const configDisabled = { ...mockConfig, generateContextFiles: false };
      const result = await generateContextFiles(mockPRs, configDisabled);
      
      expect(result.generated).toBe(0);
      expect(result.skipped).toBe(0);
    });

    it('should generate properly formatted markdown', async () => {
      await generateContextFiles(mockPRs, mockConfig);
      
      const authContent = readFileSync('src/auth/.ylog', 'utf8');
      
      expect(authContent).toContain('# Context: src/auth');
      expect(authContent).toContain('## Recent Changes');
      expect(authContent).toContain('### #1: Add authentication system');
      expect(authContent).toContain('### #2: Fix authentication token refresh');
      expect(authContent).toContain('### #3: Add user profile management');
      expect(authContent).toContain('ylog sync');
      expect(authContent).toContain('Auto-generated context file');
    });

    it('should include PR summaries when available', async () => {
      await generateContextFiles(mockPRs, mockConfig);
      
      const authContent = readFileSync('src/auth/.ylog', 'utf8');
      
      expect(authContent).toContain('Users need to authenticate to access protected resources');
      expect(authContent).toContain('Token refresh was failing causing user logouts');
    });

    it('should limit PRs based on history months', async () => {
      // Test with very short history
      const shortHistoryConfig = { ...mockConfig, historyMonths: 0 };
      await generateContextFiles(mockPRs, shortHistoryConfig);
      
      const authContent = readFileSync('src/auth/.ylog', 'utf8');
      
      // Should show 0 PRs in recent changes but still show total at bottom
      expect(authContent).toContain('## Recent Changes (0 PRs, last 0 months)');
      expect(authContent).toContain('Generated from 3 total PRs affecting this area');
    });
  });
});