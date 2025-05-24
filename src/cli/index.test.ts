import { describe, it, expect, beforeEach } from 'vitest';
import { program } from './index.js';

describe('CLI Commands', () => {
  beforeEach(() => {
    // Reset commander program state
    program.exitOverride();
  });

  it('should have correct program name and description', () => {
    expect(program.name()).toBe('ylog');
    expect(program.description()).toBe('Convert GitHub PR history into institutional memory');
  });

  it('should have all required commands', () => {
    const commands = program.commands.map(cmd => cmd.name());
    expect(commands).toContain('init');
    expect(commands).toContain('sync');
    expect(commands).toContain('show');
    expect(commands).toContain('clean');
  });

  it('should have init command with correct options', () => {
    const initCommand = program.commands.find(cmd => cmd.name() === 'init');
    expect(initCommand).toBeDefined();
    expect(initCommand?.description()).toBe('Initialize ylog configuration');
    
    const options = initCommand?.options.map(opt => opt.long);
    expect(options).toContain('--force');
    expect(options).toContain('--provider');
    expect(options).toContain('--model');
  });

  it('should have sync command with options', () => {
    const syncCommand = program.commands.find(cmd => cmd.name() === 'sync');
    expect(syncCommand).toBeDefined();
    expect(syncCommand?.description()).toBe('Sync PR history and generate context');
    
    const options = syncCommand?.options.map(opt => opt.long);
    expect(options).toContain('--config');
    expect(options).toContain('--dry-run');
  });

  it('should have show command with filter options', () => {
    const showCommand = program.commands.find(cmd => cmd.name() === 'show');
    expect(showCommand).toBeDefined();
    expect(showCommand?.description()).toBe('Query and display PR history');
    
    const options = showCommand?.options.map(opt => opt.long);
    expect(options).toContain('--config');
    expect(options).toContain('--author');
    expect(options).toContain('--since');
    expect(options).toContain('--file');
  });

  it('should have clean command with options', () => {
    const cleanCommand = program.commands.find(cmd => cmd.name() === 'clean');
    expect(cleanCommand).toBeDefined();
    expect(cleanCommand?.description()).toBe('Clean cache and generated files');
    
    const options = cleanCommand?.options.map(opt => opt.long);
    expect(options).toContain('--config');
    expect(options).toContain('--cache-only');
  });
});