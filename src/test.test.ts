import { describe, it, expect } from 'vitest';
import { hello } from './test.js';

describe('hello', () => {
  it('should return greeting message', () => {
    expect(hello('World')).toBe('Hello, World!');
  });
});