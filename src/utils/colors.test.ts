import { describe, it, expect } from 'vitest';
import { dungeonColor } from './colors.js';

describe('dungeonColor', () => {
  it('returns a non-empty hex string for index 0', () => {
    expect(dungeonColor(0)).toMatch(/^#[0-9a-f]{6}$/i);
  });
  it('wraps around at 10', () => {
    expect(dungeonColor(10)).toBe(dungeonColor(0));
    expect(dungeonColor(11)).toBe(dungeonColor(1));
  });
  it('returns different colors for indices 0-9', () => {
    const colors = Array.from({ length: 10 }, (_, i) => dungeonColor(i));
    const unique = new Set(colors);
    expect(unique.size).toBe(10);
  });
});
