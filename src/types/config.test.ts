import { describe, it, expect } from 'vitest';
import type { YlogConfig } from './config.js';
import { DEFAULT_CONFIG } from './config.js';

describe('Configuration Types', () => {
  it('should define valid YlogConfig type', () => {
    const config: YlogConfig = {
      ai: {
        provider: 'ollama',
        model: 'mistral:latest',
      },
    };

    expect(config.ai.provider).toBe('ollama');
    expect(config.ai.model).toBe('mistral:latest');
  });

  it('should provide default configuration values', () => {
    expect(DEFAULT_CONFIG.github?.throttleRpm).toBe(100);
    expect(DEFAULT_CONFIG.ai?.endpoint).toBe('http://localhost:11434');
    expect(DEFAULT_CONFIG.concurrency).toBe(10);
    expect(DEFAULT_CONFIG.outputDir).toBe('./ylog');
    expect(DEFAULT_CONFIG.generateContextFiles).toBe(true);
    expect(DEFAULT_CONFIG.contextFileThreshold).toBe(3);
    expect(DEFAULT_CONFIG.historyMonths).toBe(6);
    expect(DEFAULT_CONFIG.diffMaxBytes).toBe(1048576);
  });

  it('should support both ollama and anthropic providers', () => {
    const ollamaConfig: YlogConfig = {
      ai: {
        provider: 'ollama',
        model: 'mistral:latest',
        endpoint: 'http://localhost:11434',
      },
    };

    const anthropicConfig: YlogConfig = {
      ai: {
        provider: 'anthropic',
        model: 'claude-3-haiku',
        apiKey: 'sk-test',
      },
    };

    expect(ollamaConfig.ai.provider).toBe('ollama');
    expect(anthropicConfig.ai.provider).toBe('anthropic');
  });

  it('should handle optional configuration fields', () => {
    const minimalConfig: YlogConfig = {
      ai: {
        provider: 'ollama',
        model: 'mistral:latest',
      },
    };

    // Should compile without required fields like github.repo
    expect(minimalConfig.ai.provider).toBe('ollama');
    expect(minimalConfig.github).toBeUndefined();
  });
});