import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { rmSync, existsSync } from 'fs';
import type { ResolvedYlogConfig } from '../types/config.js';
import type { RawPR } from '../types/github.js';

// Mock all dependencies
const mockGitHubClient = {
  checkAuth: vi.fn(),
  fetchPRDetails: vi.fn(),
  fetchPRsBatch: vi.fn().mockImplementation(async function* () {
    // Return an empty async generator by default
    return;
    yield; // This line won't execute but makes TypeScript happy
  }),
};

const mockAIClient = {
  testConnection: vi.fn(),
  summarizePR: vi.fn(),
};

const mockYlogDatabase = {
  constructor: vi.fn(),
  getPR: vi.fn(),
  insertPR: vi.fn(),
  insertFileChanges: vi.fn(),
  getStats: vi.fn(() => ({ totalPRs: 0, totalFiles: 0, oldestPR: null, newestPR: null, topAuthors: [] })),
  getPRsForContext: vi.fn(() => []),
  close: vi.fn(),
};

vi.mock('./github.js', () => ({
  GitHubClient: vi.fn(() => mockGitHubClient),
}));

vi.mock('./ai.js', () => ({
  AIClient: vi.fn(() => mockAIClient),
}));

vi.mock('./database.js', () => ({
  YlogDatabase: vi.fn(() => mockYlogDatabase),
}));

// Import after mocking
const { SyncOrchestrator } = await import('./sync.js');

describe('SyncOrchestrator', () => {
  let orchestrator: InstanceType<typeof SyncOrchestrator>;
  let mockConfig: ResolvedYlogConfig;
  let testOutputDir: string;

  beforeEach(() => {
    testOutputDir = join(process.cwd(), '.test-sync');
    
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
      outputDir: testOutputDir,
      generateContextFiles: true,
      contextFileThreshold: 50,
      historyMonths: 6,
      cacheDir: join(testOutputDir, 'cache'),
      diffMaxBytes: 1000000,
    };

    // Reset all mocks
    vi.clearAllMocks();
    
    orchestrator = new SyncOrchestrator(mockConfig);
  });

  afterEach(() => {
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      expect(orchestrator).toBeInstanceOf(SyncOrchestrator);
    });

    it('should create output directory', () => {
      // Directory should be created by constructor
      expect(existsSync(testOutputDir)).toBe(true);
    });
  });

  describe('testConnections', () => {
    it('should test all connections successfully', async () => {
      mockGitHubClient.checkAuth.mockResolvedValue(undefined);
      mockAIClient.testConnection.mockResolvedValue({
        success: true,
        provider: 'ollama',
        model: 'test-model',
      });
      mockYlogDatabase.getStats.mockReturnValue({ totalPRs: 0, totalFiles: 0, oldestPR: null, newestPR: null, topAuthors: [] });

      const results = await orchestrator.testConnections();

      expect(results.github).toBe(true);
      expect(results.ai.success).toBe(true);
      expect(results.database).toBe(true);
    });

    it('should handle connection failures', async () => {
      mockGitHubClient.checkAuth.mockRejectedValue(new Error('Not authenticated'));
      mockAIClient.testConnection.mockResolvedValue({
        success: false,
        provider: 'ollama',
        model: 'test-model',
        error: 'Connection failed',
      });
      mockYlogDatabase.getStats.mockImplementation(() => {
        throw new Error('DB error');
      });

      const results = await orchestrator.testConnections();

      expect(results.github).toBe(false);
      expect(results.ai.success).toBe(false);
      expect(results.database).toBe(false);
    });
  });

  describe('sync with specific PRs', () => {
    it('should sync specific PR numbers', async () => {
      const mockPR: RawPR = {
        number: 123,
        title: 'Test PR',
        body: 'Test body',
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
            additions: 10,
            deletions: 5,
            status: 'modified',
            previous_filename: null,
          },
        ],
        reviews: [],
        labels: [],
      };

      // Mock prerequisites
      mockGitHubClient.checkAuth.mockResolvedValue(undefined);
      mockAIClient.testConnection.mockResolvedValue({
        success: true,
        provider: 'ollama',
        model: 'test-model',
      });

      // Mock PR fetching
      mockGitHubClient.fetchPRDetails.mockResolvedValue(mockPR);

      // Mock AI processing
      mockAIClient.summarizePR.mockResolvedValue({
        why: 'Test purpose',
        business_impact: 'Test impact',
        technical_changes: 'Test changes',
        areas: ['src'],
        confidence_score: 0.8,
      });

      // Mock database operations
      mockYlogDatabase.getPR.mockReturnValue(null); // PR doesn't exist
      mockYlogDatabase.insertPR.mockReturnValue(undefined);
      mockYlogDatabase.insertFileChanges.mockReturnValue(undefined);

      const result = await orchestrator.sync({
        prNumbers: [123],
      });

      expect(result.totalPRs).toBe(1);
      expect(result.processedPRs).toBe(1);
      expect(result.created).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockGitHubClient.fetchPRDetails).toHaveBeenCalledWith(123);
      expect(mockAIClient.summarizePR).toHaveBeenCalledWith(mockPR);
      expect(mockYlogDatabase.insertPR).toHaveBeenCalled();
    });

    it('should handle PR fetch errors', async () => {
      mockGitHubClient.checkAuth.mockResolvedValue(undefined);
      mockAIClient.testConnection.mockResolvedValue({
        success: true,
        provider: 'ollama',
        model: 'test-model',
      });

      mockGitHubClient.fetchPRDetails.mockRejectedValue(new Error('PR not found'));

      const result = await orchestrator.sync({
        prNumbers: [999],
      });

      expect(result.totalPRs).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].pr).toBe(999);
      expect(result.errors[0].error).toContain('Failed to fetch PR #999');
    });
  });

  describe('sync with dry run', () => {
    it('should perform dry run without database changes', async () => {
      const mockPR: RawPR = {
        number: 124,
        title: 'Dry run test',
        body: 'Test body',
        author: { login: 'testuser' },
        createdAt: '2024-01-01T00:00:00Z',
        mergedAt: '2024-01-02T00:00:00Z',
        baseRefName: 'main',
        headRefName: 'feature/test',
        url: 'https://github.com/owner/test-repo/pull/124',
        additions: 5,
        deletions: 2,
        changedFiles: 1,
        files: [],
        reviews: [],
        labels: [],
      };

      mockGitHubClient.checkAuth.mockResolvedValue(undefined);
      mockAIClient.testConnection.mockResolvedValue({
        success: true,
        provider: 'ollama',
        model: 'test-model',
      });

      mockGitHubClient.fetchPRDetails.mockResolvedValue(mockPR);
      mockAIClient.summarizePR.mockResolvedValue({
        why: 'Test purpose',
        business_impact: 'Test impact',
        technical_changes: 'Test changes',
        areas: [],
        confidence_score: 0.5,
      });

      const result = await orchestrator.sync({
        prNumbers: [124],
        dryRun: true,
      });

      expect(result.totalPRs).toBe(1);
      expect(result.processedPRs).toBe(1);
      expect(result.created).toBe(0); // No actual creation in dry run
      expect(mockYlogDatabase.insertPR).not.toHaveBeenCalled();
      expect(mockYlogDatabase.insertFileChanges).not.toHaveBeenCalled();
    });
  });

  describe('sync with AI skip', () => {
    it('should skip AI processing when requested', async () => {
      const mockPR: RawPR = {
        number: 125,
        title: 'No AI test',
        body: 'Test body',
        author: { login: 'testuser' },
        createdAt: '2024-01-01T00:00:00Z',
        mergedAt: '2024-01-02T00:00:00Z',
        baseRefName: 'main',
        headRefName: 'feature/test',
        url: 'https://github.com/owner/test-repo/pull/125',
        additions: 3,
        deletions: 1,
        changedFiles: 1,
        files: [],
        reviews: [],
        labels: [],
      };

      mockGitHubClient.checkAuth.mockResolvedValue(undefined);
      mockAIClient.testConnection.mockResolvedValue({
        success: true,
        provider: 'ollama',
        model: 'test-model',
      });

      mockGitHubClient.fetchPRDetails.mockResolvedValue(mockPR);
      mockYlogDatabase.getPR.mockReturnValue(null);

      const result = await orchestrator.sync({
        prNumbers: [125],
        skipAI: true,
      });

      expect(result.totalPRs).toBe(1);
      expect(result.processedPRs).toBe(1);
      expect(mockAIClient.summarizePR).not.toHaveBeenCalled();
      expect(mockYlogDatabase.insertPR).toHaveBeenCalledWith(
        expect.objectContaining({
          number: 125,
          why: null,
          business_impact: null,
          technical_changes: null,
        })
      );
    });
  });

  describe('progress tracking', () => {
    it('should track progress correctly', async () => {
      const progressUpdates: any[] = [];
      const onProgress = (progress: any) => {
        progressUpdates.push({ ...progress });
      };

      mockGitHubClient.checkAuth.mockResolvedValue(undefined);
      mockAIClient.testConnection.mockResolvedValue({
        success: true,
        provider: 'ollama',
        model: 'test-model',
      });

      const result = await orchestrator.sync(
        { prNumbers: [] }, // Empty list
        onProgress
      );

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].phase).toBe('fetching');
      expect(result.phase).toBe('complete');
    });
  });

  describe('error handling', () => {
    it('should handle AI connection failures', async () => {
      mockGitHubClient.checkAuth.mockResolvedValue(undefined);
      mockAIClient.testConnection.mockResolvedValue({
        success: false,
        provider: 'ollama',
        model: 'test-model',
        error: 'Connection failed',
      });

      await expect(orchestrator.sync()).rejects.toThrow('AI connection failed');
    });

    it('should handle GitHub authentication failures', async () => {
      mockGitHubClient.checkAuth.mockRejectedValue(new Error('Not authenticated'));

      await expect(orchestrator.sync()).rejects.toThrow('Not authenticated');
    });

    it('should handle AI processing errors gracefully', async () => {
      const mockPR: RawPR = {
        number: 126,
        title: 'AI error test',
        body: 'Test body',
        author: { login: 'testuser' },
        createdAt: '2024-01-01T00:00:00Z',
        mergedAt: '2024-01-02T00:00:00Z',
        baseRefName: 'main',
        headRefName: 'feature/test',
        url: 'https://github.com/owner/test-repo/pull/126',
        additions: 1,
        deletions: 0,
        changedFiles: 1,
        files: [],
        reviews: [],
        labels: [],
      };

      mockGitHubClient.checkAuth.mockResolvedValue(undefined);
      mockAIClient.testConnection.mockResolvedValue({
        success: true,
        provider: 'ollama',
        model: 'test-model',
      });

      mockGitHubClient.fetchPRDetails.mockResolvedValue(mockPR);
      mockAIClient.summarizePR.mockRejectedValue(new Error('AI service down'));
      mockYlogDatabase.getPR.mockReturnValue(null);

      const result = await orchestrator.sync({
        prNumbers: [126],
      });

      expect(result.totalPRs).toBe(1);
      expect(result.processedPRs).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('AI processing failed');
      
      // Should still save PR without AI summary
      expect(mockYlogDatabase.insertPR).toHaveBeenCalledWith(
        expect.objectContaining({
          number: 126,
          why: null,
          business_impact: null,
          technical_changes: null,
        })
      );
    });
  });

  describe('resource cleanup', () => {
    it('should close database connection', () => {
      orchestrator.close();
      expect(mockYlogDatabase.close).toHaveBeenCalled();
    });
  });
});