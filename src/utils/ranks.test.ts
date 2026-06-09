import { describe, it, expect } from 'vitest';
import { computeRanks } from './ranks.js';
import type { RankMatrixRow } from '../types.js';

describe('computeRanks', () => {
  it('assigns rank 1 to the highest median key in a season', () => {
    const input: RankMatrixRow[] = [
      { dungeon_id: 1, season_id: 10, median_key: 20 },
      { dungeon_id: 2, season_id: 10, median_key: 25 },
      { dungeon_id: 3, season_id: 10, median_key: 18 },
    ];
    const result = computeRanks(input);
    const d2 = result.find(r => r.dungeon_id === 2)!;
    expect(d2.rank).toBe(1);
    expect(d2.total).toBe(3);
  });

  it('assigns ranks independently per season', () => {
    const input: RankMatrixRow[] = [
      { dungeon_id: 1, season_id: 6, median_key: 30 },
      { dungeon_id: 2, season_id: 6, median_key: 25 },
      { dungeon_id: 2, season_id: 7, median_key: 22 },
      { dungeon_id: 1, season_id: 7, median_key: 28 },
    ];
    const result = computeRanks(input);
    const d1s6 = result.find(r => r.dungeon_id === 1 && r.season_id === 6)!;
    const d2s7 = result.find(r => r.dungeon_id === 2 && r.season_id === 7)!;
    expect(d1s6.rank).toBe(1);
    expect(d2s7.rank).toBe(2);
  });

  it('handles a single dungeon in a season', () => {
    const input: RankMatrixRow[] = [
      { dungeon_id: 5, season_id: 15, median_key: 16 },
    ];
    const result = computeRanks(input);
    expect(result[0].rank).toBe(1);
    expect(result[0].total).toBe(1);
  });
});
