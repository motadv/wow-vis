import { describe, it, expect } from 'vitest';
import { expansionName, seasonLabel } from './seasons.js';
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

describe('seasonLabel', () => {
  it('extracts the season number from a valid season name', () => {
    expect(seasonLabel(season(9, 'Mythic+ Dungeons (Dragonflight Season 1)'))).toBe('Season 1');
    expect(seasonLabel(season(12, 'Mythic+ Dungeons (Dragonflight Season 4)'))).toBe('Season 4');
    expect(seasonLabel(season(14, 'Mythic+ Dungeons (The War Within Season 2)'))).toBe('Season 2');
  });

  it('falls back to S{id} for unparseable name', () => {
    expect(seasonLabel(season(1, 'Season 1'))).toBe('S1');
  });
});
