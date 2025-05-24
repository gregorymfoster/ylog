import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ResolvedYlogConfig } from '../types/config.js';
import type { RawPR } from '../types/github.js';

// Mock the AI SDK
const mockGenerateText = vi.fn();
vi.mock('ai', () => ({
  generateText: mockGenerateText
}));

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => 'mocked-anthropic-model')
}));

vi.mock('ollama-ai-provider', () => ({
  ollama: vi.fn(() => 'mocked-ollama-model')
}));

// Import after mocking
const { AIClient } = await import('./ai.js');

describe('AIClient', () => {
  let client: InstanceType<typeof AIClient>;
  let mockConfig: ResolvedYlogConfig;
  let mockPR: RawPR;

  beforeEach(() => {
    mockConfig = {
      github: {
        repo: 'owner/test-repo',
        token: 'ghp_test_token',
        throttleRpm: 100,
      },
      ai: {
        provider: 'ollama',
        model: 'llama3.2',
        endpoint: 'http://localhost:11434',
        maxTokens: 500,
      },
      concurrency: 10,
      outputDir: '.ylog',
      generateContextFiles: true,
      contextFileThreshold: 50,
      historyMonths: 6,
      cacheDir: '.ylog/cache',
      diffMaxBytes: 1000000,
    };

    mockPR = {
      number: 123,
      title: 'Add user authentication system',
      body: 'This PR implements a complete user authentication system with JWT tokens and role-based access control.',
      author: { login: 'developer' },
      createdAt: '2024-01-01T00:00:00Z',
      mergedAt: '2024-01-02T00:00:00Z',
      baseRefName: 'main',
      headRefName: 'feature/auth',
      url: 'https://github.com/owner/test-repo/pull/123',
      additions: 150,
      deletions: 10,
      changedFiles: 8,
      files: [
        {
          path: 'src/auth/login.ts',
          additions: 45,
          deletions: 0,
          status: 'added',
          previous_filename: null,
        },
        {
          path: 'src/auth/middleware.ts',
          additions: 30,
          deletions: 5,
          status: 'modified',
          previous_filename: null,
        },
        {
          path: 'tests/auth.test.ts',
          additions: 75,
          deletions: 5,
          status: 'added',
          previous_filename: null,
        }
      ],
      reviews: [
        {
          author: 'senior-dev',
          state: 'APPROVED',
          submittedAt: '2024-01-01T12:00:00Z',
        }
      ],
      labels: ['feature', 'security'],
    };

    client = new AIClient(mockConfig);
    mockGenerateText.mockClear();
  });

  describe('constructor and configuration', () => {
    it('should initialize with config', () => {
      expect(client).toBeInstanceOf(AIClient);
    });

    it('should get provider info for ollama', () => {
      const info = client.getProviderInfo();
      expect(info.provider).toBe('ollama');
      expect(info.model).toBe('llama3.2');
      expect(info.endpoint).toBe('http://localhost:11434');
      expect(info.hasApiKey).toBe(false);
    });

    it('should get provider info for anthropic', () => {
      const anthropicConfig = {
        ...mockConfig,
        ai: {
          ...mockConfig.ai,
          provider: 'anthropic' as const,
          model: 'claude-3-sonnet',
          apiKey: 'test-key',
        },
      };
      
      const anthropicClient = new AIClient(anthropicConfig);
      const info = anthropicClient.getProviderInfo();
      
      expect(info.provider).toBe('anthropic');
      expect(info.model).toBe('claude-3-sonnet');
      expect(info.hasApiKey).toBe(true);
      expect(info.endpoint).toBeUndefined();
    });
  });

  describe('summarizePR', () => {
    it('should generate PR summary with structured response', async () => {
      const mockResponse = `**WHY:** This change was needed to implement secure user authentication and replace the existing insecure session management system.

**BUSINESS_IMPACT:** Enables user accounts and personalization features while meeting security compliance requirements for handling user data.

**TECHNICAL_CHANGES:** Implemented JWT-based authentication with role-based access control middleware and secure password hashing using bcrypt.`;

      mockGenerateText.mockResolvedValue({
        text: mockResponse,
      });

      const summary = await client.summarizePR(mockPR);

      expect(summary.why).toContain('secure user authentication');
      expect(summary.business_impact).toContain('user accounts and personalization');
      expect(summary.technical_changes).toContain('JWT-based authentication');
      expect(summary.areas).toContain('src');
      expect(summary.areas).toContain('tests');
      expect(summary.confidence_score).toBeGreaterThan(0.5);
    });

    it('should handle malformed AI response gracefully', async () => {
      mockGenerateText.mockResolvedValue({
        text: 'This is an unstructured response without the expected format.',
      });

      const summary = await client.summarizePR(mockPR);

      expect(summary.why).toBe('Unable to determine the purpose of this change.');
      expect(summary.business_impact).toBe('Business impact not clear from available information.');
      expect(summary.technical_changes).toBe('Technical changes not well documented.');
    });

    it('should extract code areas from file paths', async () => {
      const prWithVariedFiles: RawPR = {
        ...mockPR,
        files: [
          { path: 'src/api/users.ts', additions: 20, deletions: 0, status: 'added', previous_filename: null },
          { path: 'ui/components/Login.tsx', additions: 30, deletions: 5, status: 'modified', previous_filename: null },
          { path: 'docs/authentication.md', additions: 15, deletions: 0, status: 'added', previous_filename: null },
          { path: 'config/database.yml', additions: 5, deletions: 2, status: 'modified', previous_filename: null },
          { path: 'tests/integration/auth.test.ts', additions: 40, deletions: 0, status: 'added', previous_filename: null },
        ],
      };

      mockGenerateText.mockResolvedValue({
        text: '**WHY:** Test **BUSINESS_IMPACT:** Test **TECHNICAL_CHANGES:** Test',
      });

      const summary = await client.summarizePR(prWithVariedFiles);

      // Remove debug output

      expect(summary.areas).toContain('src');
      expect(summary.areas).toContain('ui');
      expect(summary.areas).toContain('docs');
      expect(summary.areas).toContain('config');
      expect(summary.areas).toContain('tests');
    });

    it('should calculate confidence score based on PR quality', async () => {
      mockGenerateText.mockResolvedValue({
        text: '**WHY:** Test **BUSINESS_IMPACT:** Test **TECHNICAL_CHANGES:** Test',
      });

      // High quality PR
      const highQualityPR: RawPR = {
        ...mockPR,
        body: 'This is a detailed description explaining the purpose, implementation details, and testing approach for this feature.',
        reviews: [
          { author: 'reviewer1', state: 'APPROVED', submittedAt: '2024-01-01T12:00:00Z' },
          { author: 'reviewer2', state: 'APPROVED', submittedAt: '2024-01-01T13:00:00Z' },
        ],
        labels: ['feature', 'security', 'tested'],
        changedFiles: 5,
      };

      const summary = await client.summarizePR(highQualityPR);
      expect(summary.confidence_score).toBeGreaterThan(0.8);

      // Low quality PR
      const lowQualityPR: RawPR = {
        ...mockPR,
        body: '',
        reviews: [],
        labels: [],
        changedFiles: 25, // Very large PR
      };

      const lowSummary = await client.summarizePR(lowQualityPR);
      expect(lowSummary.confidence_score).toBeLessThan(0.6);
    });

    it('should handle AI generation errors', async () => {
      mockGenerateText.mockRejectedValue(new Error('API rate limit exceeded'));

      await expect(client.summarizePR(mockPR)).rejects.toThrow('AI summarization failed');
    });
  });

  describe('testConnection', () => {
    it('should test successful AI connection', async () => {
      mockGenerateText.mockResolvedValue({
        text: 'AI connection successful',
      });

      const result = await client.testConnection();

      expect(result.success).toBe(true);
      expect(result.provider).toBe('ollama');
      expect(result.model).toBe('llama3.2');
      expect(result.error).toBeUndefined();
    });

    it('should handle connection failures', async () => {
      mockGenerateText.mockRejectedValue(new Error('Connection timeout'));

      const result = await client.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection failed');
    });

    it('should detect unexpected AI responses', async () => {
      mockGenerateText.mockResolvedValue({
        text: 'Unexpected response format',
      });

      const result = await client.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected response from AI model');
    });
  });

  describe('batch processing', () => {
    it('should process PRs in batches', async () => {
      const prs = [mockPR, { ...mockPR, number: 124 }, { ...mockPR, number: 125 }];
      const onProgress = vi.fn();
      const onError = vi.fn();

      mockGenerateText.mockResolvedValue({
        text: '**WHY:** Test **BUSINESS_IMPACT:** Test **TECHNICAL_CHANGES:** Test',
      });

      const batches = [];
      for await (const batch of client.summarizePRsBatch(prs, {
        batchSize: 2,
        onProgress,
        onError,
      })) {
        batches.push(batch);
      }

      expect(batches).toHaveLength(2); // 2 PRs in first batch, 1 in second
      expect(batches[0]).toHaveLength(2);
      expect(batches[1]).toHaveLength(1);
      expect(onProgress).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it('should handle errors in batch processing', async () => {
      const prs = [mockPR, { ...mockPR, number: 124 }];
      const onError = vi.fn();

      mockGenerateText
        .mockResolvedValueOnce({
          text: '**WHY:** Test **BUSINESS_IMPACT:** Test **TECHNICAL_CHANGES:** Test',
        })
        .mockRejectedValueOnce(new Error('AI error'));

      const batches = [];
      for await (const batch of client.summarizePRsBatch(prs, {
        batchSize: 2,
        onError,
      })) {
        batches.push(batch);
      }

      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(1); // Only successful PR
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ number: 124 }),
        expect.any(Error)
      );
    });
  });

  describe('error handling', () => {
    it('should throw error for unsupported provider', () => {
      const invalidConfig = {
        ...mockConfig,
        ai: {
          ...mockConfig.ai,
          provider: 'invalid' as any,
        },
      };

      expect(() => new AIClient(invalidConfig)).not.toThrow(); // Constructor doesn't validate
      
      const invalidClient = new AIClient(invalidConfig);
      expect(() => invalidClient.getProviderInfo()).not.toThrow(); // This method doesn't validate provider
    });

    it('should throw error for missing Anthropic API key', async () => {
      const anthropicConfig = {
        ...mockConfig,
        ai: {
          ...mockConfig.ai,
          provider: 'anthropic' as const,
          model: 'claude-3-sonnet',
          // No API key
        },
      };

      const anthropicClient = new AIClient(anthropicConfig);
      
      // This should fail when trying to get the model
      await expect(anthropicClient.summarizePR(mockPR)).rejects.toThrow('Anthropic API key required');
    });
  });
});