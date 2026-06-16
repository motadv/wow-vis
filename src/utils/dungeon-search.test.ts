import { describe, it, expect } from 'vitest';
import { matchesDungeonSearch } from './dungeon-search.js';

describe('matchesDungeonSearch', () => {
  it('matches substring case-insensitively', () => {
    expect(matchesDungeonSearch('Deadmines', 'dead')).toBe(true);
    expect(matchesDungeonSearch('Deadmines', 'DEAD')).toBe(true);
  });

  it('returns false when query is not in name', () => {
    expect(matchesDungeonSearch('Deadmines', 'siege')).toBe(false);
  });

  it('matches full name exactly', () => {
    expect(matchesDungeonSearch('Siege of Boralus', 'Siege of Boralus')).toBe(true);
  });

  it('returns true when query is empty string', () => {
    expect(matchesDungeonSearch('Deadmines', '')).toBe(true);
  });
});
