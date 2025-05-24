import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ResolvedYlogConfig } from '../types/config.js';

// Mock Octokit before importing GitHubClient
const mockOctokit = {
  rest: {
    users: {
      getAuthenticated: vi.fn(),
    },
    pulls: {
      list: vi.fn(),
      get: vi.fn(),
      listFiles: vi.fn(),
      listReviews: vi.fn(),
    },
    repos: {
      get: vi.fn(),
    },
  },
  paginate: {
    iterator: vi.fn(),
  },
};

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn(() => mockOctokit),
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
        token: 'ghp_test_token',
        throttleRpm: 60,
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

    // Reset all mocks
    vi.clearAllMocks();

    client = new GitHubClient(mockConfig);
  });

  describe('constructor', () => {
    it('should parse owner/repo correctly', () => {
      expect(() => new GitHubClient(mockConfig)).not.toThrow();
    });

    it('should throw error for invalid repo format', () => {
      const invalidConfig = {
        ...mockConfig,
        github: { ...mockConfig.github, repo: 'invalid-repo' },
      };
      
      expect(() => new GitHubClient(invalidConfig)).toThrow('Invalid repository format');
    });
  });

  describe('checkAuth', () => {
    it('should succeed when Octokit authentication works', async () => {
      mockOctokit.rest.users.getAuthenticated.mockResolvedValue({ data: { login: 'testuser' } });
      
      await expect(client.checkAuth()).resolves.toBeUndefined();
      expect(mockOctokit.rest.users.getAuthenticated).toHaveBeenCalled();
    });

    it('should throw error when authentication fails', async () => {
      mockOctokit.rest.users.getAuthenticated.mockRejectedValue(new Error('Bad credentials'));
      
      await expect(client.checkAuth()).rejects.toThrow('GitHub authentication failed');
    });
  });

  describe('fetchPRList', () => {
    it('should fetch PR list with default options', async () => {
      const mockPRs = [
        {
          number: 123,
          title: 'Test PR',
          user: { login: 'testuser' },
          created_at: '2024-01-01T00:00:00Z',
          merged_at: '2024-01-02T00:00:00Z',
          html_url: 'https://github.com/owner/test-repo/pull/123',
        },
      ];

      // Mock paginate iterator
      mockOctokit.paginate.iterator.mockImplementation(async function* () {
        yield { data: mockPRs };
      });
      
      const result = await client.fetchPRList();
      
      expect(result.prs).toHaveLength(1);
      expect(result.prs[0].number).toBe(123);
      expect(result.prs[0].title).toBe('Test PR');
      expect(mockOctokit.paginate.iterator).toHaveBeenCalledWith(
        mockOctokit.rest.pulls.list,
        {
          owner: 'owner',
          repo: 'test-repo',
          state: 'closed',
          sort: 'created',
          direction: 'desc',
          per_page: 100,
        }
      );
    });

    it('should filter PRs by date when since option is provided', async () => {
      const mockPRs = [
        {
          number: 123,
          title: 'Old PR',
          user: { login: 'testuser' },
          created_at: '2023-01-01T00:00:00Z',
          merged_at: '2023-01-02T00:00:00Z',
          html_url: 'https://github.com/owner/test-repo/pull/123',
        },
        {
          number: 124,
          title: 'New PR',
          user: { login: 'testuser' },
          created_at: '2024-01-01T00:00:00Z',
          merged_at: '2024-01-02T00:00:00Z',
          html_url: 'https://github.com/owner/test-repo/pull/124',
        },
      ];

      mockOctokit.paginate.iterator.mockImplementation(async function* () {
        yield { data: mockPRs };
      });
      
      const result = await client.fetchPRList({ since: '2024-01-01T00:00:00Z' });
      
      expect(result.prs).toHaveLength(1);
      expect(result.prs[0].number).toBe(124);
    });

    it('should skip non-merged PRs when state is closed', async () => {
      const mockPRs = [
        {
          number: 123,
          title: 'Merged PR',
          user: { login: 'testuser' },
          created_at: '2024-01-01T00:00:00Z',
          merged_at: '2024-01-02T00:00:00Z',
          html_url: 'https://github.com/owner/test-repo/pull/123',
        },
        {
          number: 124,
          title: 'Closed but not merged PR',
          user: { login: 'testuser' },
          created_at: '2024-01-01T00:00:00Z',
          merged_at: null,
          html_url: 'https://github.com/owner/test-repo/pull/124',
        },
      ];

      mockOctokit.paginate.iterator.mockImplementation(async function* () {
        yield { data: mockPRs };
      });
      
      const result = await client.fetchPRList({ state: 'closed' });
      
      expect(result.prs).toHaveLength(1);
      expect(result.prs[0].number).toBe(123);
    });
  });

  describe('fetchPRDetails', () => {
    it('should fetch detailed PR information', async () => {
      const mockPR = {
        number: 123,
        title: 'Test PR',
        body: 'Test description',
        user: { login: 'testuser' },
        created_at: '2024-01-01T00:00:00Z',
        merged_at: '2024-01-02T00:00:00Z',
        base: { ref: 'main' },
        head: { ref: 'feature/test' },
        html_url: 'https://github.com/owner/test-repo/pull/123',
        additions: 10,
        deletions: 5,
        changed_files: 2,
        labels: [{ name: 'feature' }, { name: 'bug' }],
      };

      const mockFiles = [
        {
          filename: 'src/test.ts',
          additions: 8,
          deletions: 3,
          status: 'modified',
          previous_filename: null,
        },
      ];

      const mockReviews = [
        {
          user: { login: 'reviewer' },
          state: 'APPROVED',
          submitted_at: '2024-01-01T12:00:00Z',
          updated_at: '2024-01-01T12:00:00Z',
        },
      ];

      mockOctokit.rest.pulls.get.mockResolvedValue({ data: mockPR });
      mockOctokit.rest.pulls.listFiles.mockResolvedValue({ data: mockFiles });
      mockOctokit.rest.pulls.listReviews.mockResolvedValue({ data: mockReviews });
      
      const result = await client.fetchPRDetails(123);
      
      expect(result.number).toBe(123);
      expect(result.title).toBe('Test PR');
      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('src/test.ts');
      expect(result.reviews).toHaveLength(1);
      expect(result.reviews[0].author).toBe('reviewer');
      expect(result.labels).toEqual(['feature', 'bug']);
    });

    it('should handle PRs without optional data', async () => {
      const mockPR = {
        number: 124,
        title: 'Minimal PR',
        body: null,
        user: { login: 'testuser' },
        created_at: '2024-01-01T00:00:00Z',
        merged_at: '2024-01-02T00:00:00Z',
        base: { ref: 'main' },
        head: { ref: 'feature/minimal' },
        html_url: 'https://github.com/owner/test-repo/pull/124',
        additions: 0,
        deletions: 0,
        changed_files: 0,
        labels: [],
      };

      mockOctokit.rest.pulls.get.mockResolvedValue({ data: mockPR });
      mockOctokit.rest.pulls.listFiles.mockResolvedValue({ data: [] });
      mockOctokit.rest.pulls.listReviews.mockResolvedValue({ data: [] });
      
      const result = await client.fetchPRDetails(124);
      
      expect(result.number).toBe(124);
      expect(result.body).toBe('');
      expect(result.files).toHaveLength(0);
      expect(result.reviews).toHaveLength(0);
      expect(result.labels).toHaveLength(0);
    });

    it('should handle API errors gracefully', async () => {
      mockOctokit.rest.pulls.get.mockRejectedValue(new Error('Not found'));
      
      await expect(client.fetchPRDetails(999)).rejects.toThrow('Failed to fetch PR #999');
    });
  });

  describe('getRepoInfo', () => {
    it('should fetch repository information', async () => {
      const mockRepo = {
        name: 'test-repo',
        full_name: 'owner/test-repo',
        default_branch: 'main',
        description: 'A test repository',
      };

      mockOctokit.rest.repos.get.mockResolvedValue({ data: mockRepo });
      
      const result = await client.getRepoInfo();
      
      expect(result.name).toBe('test-repo');
      expect(result.fullName).toBe('owner/test-repo');
      expect(result.defaultBranch).toBe('main');
      expect(result.description).toBe('A test repository');
      expect(mockOctokit.rest.repos.get).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'test-repo',
      });
    });

    it('should handle repos without description', async () => {
      const mockRepo = {
        name: 'test-repo',
        full_name: 'owner/test-repo',
        default_branch: 'main',
        description: null,
      };

      mockOctokit.rest.repos.get.mockResolvedValue({ data: mockRepo });
      
      const result = await client.getRepoInfo();
      
      expect(result.description).toBe('');
    });
  });

  describe('fetchPRsBatch', () => {
    it('should process PRs in batches', async () => {
      const mockPRList = [
        {
          number: 123,
          title: 'PR 1',
          user: { login: 'user1' },
          created_at: '2024-01-01T00:00:00Z',
          merged_at: '2024-01-02T00:00:00Z',
          html_url: 'https://github.com/owner/test-repo/pull/123',
        },
        {
          number: 124,
          title: 'PR 2',
          user: { login: 'user2' },
          created_at: '2024-01-01T00:00:00Z',
          merged_at: '2024-01-02T00:00:00Z',
          html_url: 'https://github.com/owner/test-repo/pull/124',
        },
      ];

      mockOctokit.paginate.iterator.mockImplementation(async function* () {
        yield { data: mockPRList };
      });

      // Mock fetchPRDetails calls
      const mockPRDetails = {
        number: 123,
        title: 'PR 1',
        body: '',
        author: { login: 'user1' },
        createdAt: '2024-01-01T00:00:00Z',
        mergedAt: '2024-01-02T00:00:00Z',
        baseRefName: 'main',
        headRefName: 'feature/1',
        url: 'https://github.com/owner/test-repo/pull/123',
        additions: 0,
        deletions: 0,
        changedFiles: 0,
        files: [],
        reviews: [],
        labels: [],
      };

      mockOctokit.rest.pulls.get.mockResolvedValue({ 
        data: { 
          ...mockPRDetails, 
          user: { login: 'user1' },
          created_at: '2024-01-01T00:00:00Z',
          merged_at: '2024-01-02T00:00:00Z',
          base: { ref: 'main' },
          head: { ref: 'feature/1' },
          html_url: 'https://github.com/owner/test-repo/pull/123',
          labels: [],
        }
      });
      mockOctokit.rest.pulls.listFiles.mockResolvedValue({ data: [] });
      mockOctokit.rest.pulls.listReviews.mockResolvedValue({ data: [] });

      const batches = [];
      const progressCalls: Array<{ processed: number; total: number }> = [];
      
      for await (const batch of client.fetchPRsBatch({
        batchSize: 1,
        onProgress: (processed, total) => progressCalls.push({ processed, total }),
      })) {
        batches.push(batch);
      }

      expect(batches).toHaveLength(2); // 2 PRs with batchSize 1
      expect(progressCalls).toHaveLength(2);
      expect(progressCalls[1]).toEqual({ processed: 2, total: 2 });
    });
  });

  describe('stats tracking', () => {
    it('should track request statistics', () => {
      const initialStats = client.getStats();
      expect(initialStats.requestCount).toBe(0);
      
      client.resetStats();
      const resetStats = client.getStats();
      expect(resetStats.requestCount).toBe(0);
    });

    it('should increment request count on fetchPRDetails', async () => {
      mockOctokit.rest.pulls.get.mockResolvedValue({ 
        data: { 
          number: 123, 
          title: 'Test',
          user: { login: 'test' },
          created_at: '2024-01-01T00:00:00Z',
          base: { ref: 'main' },
          head: { ref: 'feature' },
          html_url: 'https://github.com/test/test/pull/123',
          labels: [],
        }
      });
      mockOctokit.rest.pulls.listFiles.mockResolvedValue({ data: [] });
      mockOctokit.rest.pulls.listReviews.mockResolvedValue({ data: [] });

      await client.fetchPRDetails(123);
      
      const stats = client.getStats();
      expect(stats.requestCount).toBe(1);
    });
  });
});