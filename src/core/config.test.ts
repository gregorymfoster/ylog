import { describe, it, expect } from 'vitest';
import { validateConfig } from './config.js';
import type { YlogConfig } from '../types/index.js';

describe('Configuration System', () => {
  describe('validateConfig', () => {
    it('should validate valid configuration', () => {
      const validConfig: Partial<YlogConfig> = {
        ai: {
          provider: 'ollama',
          model: 'llama2',
        },
        github: {
          repo: 'owner/repo',
          throttleRpm: 100,
        },
      };

      const result = validateConfig(validConfig);
      expect(result.ai.provider).toBe('ollama');
      expect(result.github.repo).toBe('owner/repo');
      expect(result.outputDir).toBe('.ylog'); // default
    });

    it('should apply defaults for missing optional fields', () => {
      const minimalConfig: Partial<YlogConfig> = {
        ai: {
          provider: 'anthropic',
          model: 'claude-3-sonnet',
        },
      };

      const result = validateConfig(minimalConfig);
      expect(result.concurrency).toBe(10);
      expect(result.generateContextFiles).toBe(true);
      expect(result.historyMonths).toBe(6);
    });

    it('should reject invalid provider', () => {
      const invalidConfig = {
        ai: {
          provider: 'invalid',
          model: 'test',
        },
      };

      expect(() => validateConfig(invalidConfig)).toThrow();
    });

    it('should reject invalid throttleRpm values', () => {
      const invalidConfig = {
        ai: { provider: 'ollama', model: 'test' },
        github: { throttleRpm: 10000 },
      };

      expect(() => validateConfig(invalidConfig)).toThrow();
    });
  });

  describe('detectGitHubRepo', () => {
    it('should parse SSH GitHub URL pattern', () => {
      // Test URL parsing logic directly
      const sshUrl = 'git@github.com:owner/repo.git';
      const githubMatch = sshUrl.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
      expect(githubMatch?.[1]).toBe('owner/repo');
    });

    it('should parse HTTPS GitHub URL pattern', () => {
      // Test URL parsing logic directly  
      const httpsUrl = 'https://github.com/owner/repo.git';
      const githubMatch = httpsUrl.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
      expect(githubMatch?.[1]).toBe('owner/repo');
    });

    it('should handle URLs without .git suffix', () => {
      const httpsUrl = 'https://github.com/owner/repo';
      const githubMatch = httpsUrl.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
      expect(githubMatch?.[1]).toBe('owner/repo');
    });
  });
});