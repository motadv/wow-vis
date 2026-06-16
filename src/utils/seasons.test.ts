import { describe, it, expect } from 'vitest';
import { expansionName } from './seasons.js';
import type { SeasonMeta } from '../types.js';

function season(id: number, name: string): SeasonMeta {
  return { id, name, startTimestamp: 0, dungeonIds: [] };
}

describe('expansionName', () => {
  it('extracts expansion from a valid season name', () => {
    expect(expansionName(season(5, 'Mythic+ Dungeons (Shadowlands Season 1)'))).toBe('Shadowlands');
    expect(expansionName(season(9, 'Mythic+ Dungeons (Dragonflight Season 1)'))).toBe('Dragonflight');
    expect(expansionName(season(13, 'Mythic+ Dungeons (The War Within Season 1)'))).toBe('The War Within');
  });

  it('returns null for an unparseable season name', () => {
    expect(expansionName(season(1, 'Season 1'))).toBeNull();
  });
});
