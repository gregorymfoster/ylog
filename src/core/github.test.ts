import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ResolvedYlogConfig } from '../types/config.js';

// Mock execSync before importing GitHubClient
const mockExecSync = vi.fn();
vi.mock('child_process', () => ({
  execSync: mockExecSync
}));

// Import after mocking
const { GitHubClient } = await import('./github.js');

describe('GitHubClient', () => {
  let client: InstanceType<typeof GitHubClient>;
  let mockConfig: ResolvedYlogConfig;

  beforeEach(() => {
    mockConfig = {
      github: {
        repo: 'owner/test-repo',
        throttleRpm: 60, // 1 request per second for testing
      },
      ai: {
        provider: 'ollama',
        model: 'test-model',
      },
      concurrency: 10,
      outputDir: '.ylog',
      generateContextFiles: true,
      contextFileThreshold: 50,
      historyMonths: 6,
      cacheDir: '.ylog/cache',
      diffMaxBytes: 1000000,
    };

    client = new GitHubClient(mockConfig);
    mockExecSync.mockClear();
  });

  describe('checkAuth', () => {
    it('should succeed when gh CLI is authenticated', async () => {
      mockExecSync.mockReturnValue('Logged in to github.com as user');
      
      await expect(client.checkAuth()).resolves.toBeUndefined();
      expect(mockExecSync).toHaveBeenCalledWith('gh auth status', { stdio: 'pipe' });
    });

    it('should throw error when gh CLI is not authenticated', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not logged in');
      });
      
      await expect(client.checkAuth()).rejects.toThrow('GitHub CLI not authenticated');
    });
  });

  describe('fetchPRList', () => {
    it('should fetch PR list with default options', async () => {
      const mockPRs = [
        {
          number: 123,
          title: 'Test PR',
          author: { login: 'testuser' },
          createdAt: '2024-01-01T00:00:00Z',
          mergedAt: '2024-01-02T00:00:00Z',
          url: 'https://github.com/owner/test-repo/pull/123'
        }
      ];
      
      mockExecSync.mockReturnValue(JSON.stringify(mockPRs));
      
      const result = await client.fetchPRList();
      
      expect(result.prs).toHaveLength(1);
      expect(result.prs[0].number).toBe(123);
      expect(result.prs[0].title).toBe('Test PR');
      expect(mockExecSync).toHaveBeenCalledWith(
        'gh pr list --repo owner/test-repo --state merged --json number,title,author,createdAt,mergedAt,url --limit 100',
        expect.any(Object)
      );
    });

    it('should filter PRs by date when since option is provided', async () => {
      const mockPRs = [
        {
          number: 123,
          title: 'Old PR',
          author: { login: 'testuser' },
          createdAt: '2023-01-01T00:00:00Z',
          mergedAt: '2023-01-02T00:00:00Z',
          url: 'https://github.com/owner/test-repo/pull/123'
        },
        {
          number: 124,
          title: 'New PR',
          author: { login: 'testuser' },
          createdAt: '2024-01-01T00:00:00Z',
          mergedAt: '2024-01-02T00:00:00Z',
          url: 'https://github.com/owner/test-repo/pull/124'
        }
      ];
      
      mockExecSync.mockReturnValue(JSON.stringify(mockPRs));
      
      const result = await client.fetchPRList({ since: '2024-01-01T00:00:00Z' });
      
      expect(result.prs).toHaveLength(1);
      expect(result.prs[0].number).toBe(124);
    });
  });

  describe('fetchPRDetails', () => {
    it('should fetch detailed PR information', async () => {
      const mockPR = {
        number: 123,
        title: 'Test PR',
        body: 'Test description',
        author: { login: 'testuser' },
        createdAt: '2024-01-01T00:00:00Z',
        mergedAt: '2024-01-02T00:00:00Z',
        baseRefName: 'main',
        headRefName: 'feature/test',
        url: 'https://github.com/owner/test-repo/pull/123',
        additions: 10,
        deletions: 5,
        changedFiles: 2,
        files: [
          {
            path: 'src/test.ts',
            additions: 8,
            deletions: 3,
            status: 'modified'
          }
        ],
        reviews: [
          {
            author: { login: 'reviewer' },
            state: 'APPROVED',
            submittedAt: '2024-01-01T12:00:00Z'
          }
        ],
        labels: [{ name: 'feature' }, { name: 'bug' }]
      };
      
      mockExecSync.mockReturnValue(JSON.stringify(mockPR));
      
      const result = await client.fetchPRDetails(123);
      
      expect(result.number).toBe(123);
      expect(result.title).toBe('Test PR');
      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('src/test.ts');
      expect(result.reviews).toHaveLength(1);
      expect(result.reviews[0].author).toBe('reviewer');
      expect(result.labels).toEqual(['feature', 'bug']);
    });

    it('should handle PRs without file details', async () => {
      const mockPR = {
        number: 124,
        title: 'No files PR',
        body: '',
        author: { login: 'testuser' },
        createdAt: '2024-01-01T00:00:00Z',
        mergedAt: '2024-01-02T00:00:00Z',
        baseRefName: 'main',
        headRefName: 'feature/empty',
        url: 'https://github.com/owner/test-repo/pull/124',
        additions: 0,
        deletions: 0,
        changedFiles: 0,
        files: [],
        reviews: [],
        labels: []
      };
      
      mockExecSync.mockReturnValue(JSON.stringify(mockPR));
      
      const result = await client.fetchPRDetails(124);
      
      expect(result.number).toBe(124);
      expect(result.files).toHaveLength(0);
      expect(result.reviews).toHaveLength(0);
      expect(result.labels).toHaveLength(0);
    });
  });

  describe('getRepoInfo', () => {
    it('should fetch repository information', async () => {
      const mockRepo = {
        name: 'test-repo',
        nameWithOwner: 'owner/test-repo',
        defaultBranchRef: { name: 'main' },
        description: 'A test repository'
      };
      
      mockExecSync.mockReturnValue(JSON.stringify(mockRepo));
      
      const result = await client.getRepoInfo();
      
      expect(result.name).toBe('test-repo');
      expect(result.fullName).toBe('owner/test-repo');
      expect(result.defaultBranch).toBe('main');
      expect(result.description).toBe('A test repository');
    });

    it('should handle repos without default branch', async () => {
      const mockRepo = {
        name: 'test-repo',
        nameWithOwner: 'owner/test-repo',
        defaultBranchRef: null,
        description: ''
      };
      
      mockExecSync.mockReturnValue(JSON.stringify(mockRepo));
      
      const result = await client.getRepoInfo();
      
      expect(result.defaultBranch).toBe('main'); // fallback
      expect(result.description).toBe('');
    });
  });

  describe('rate limiting', () => {
    it('should track request statistics', () => {
      const initialStats = client.getStats();
      expect(initialStats.requestCount).toBe(0);
      
      client.resetStats();
      const resetStats = client.getStats();
      expect(resetStats.requestCount).toBe(0);
      expect(resetStats.lastRequestTime).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle rate limit errors with retry', async () => {
      mockExecSync
        .mockImplementationOnce(() => {
          throw new Error('rate limit exceeded');
        })
        .mockReturnValue(JSON.stringify([]));
      
      // Mock setTimeout to avoid actual waiting in tests
      vi.spyOn(global, 'setTimeout').mockImplementation((fn: any) => {
        fn();
        return 0 as any;
      });
      
      const result = await client.fetchPRList();
      expect(result.prs).toHaveLength(0);
      expect(mockExecSync).toHaveBeenCalledTimes(2); // Initial call + retry
    });

    it('should handle network errors with retry', async () => {
      mockExecSync
        .mockImplementationOnce(() => {
          throw new Error('network timeout');
        })
        .mockReturnValue(JSON.stringify([]));
      
      vi.spyOn(global, 'setTimeout').mockImplementation((fn: any) => {
        fn();
        return 0 as any;
      });
      
      const result = await client.fetchPRList();
      expect(result.prs).toHaveLength(0);
      expect(mockExecSync).toHaveBeenCalledTimes(2);
    });

    it('should propagate other errors', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('unknown error');
      });
      
      await expect(client.fetchPRList()).rejects.toThrow('GitHub CLI error: unknown error');
    });
  });
});