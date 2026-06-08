import { describe, it, expect } from 'vitest';
import { transformLeaderboard } from './transform.js';
import type { BlizzardLeaderboard } from './types.js';

const base: BlizzardLeaderboard = {
  map_challenge_mode_id: 42,
  name: 'Test Dungeon',
  map: { name: 'Test Dungeon', id: 99 },
  period: 1001,
  leading_groups: [
    { ranking: 1, duration_ms: 120000, completed_timestamp: 0, keystone_level: 20, members: [] },
    { ranking: 2, duration_ms: 135000, completed_timestamp: 0, keystone_level: 19, members: [] },
  ],
};

describe('transformLeaderboard', () => {
  it('maps each leading_group to a LeaderboardEntry', () => {
    const result = transformLeaderboard(base, 7, 11);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      dungeon_id: 42,
      season_id: 7,
      period: 1001,
      realm_id: 11,
      keystone_level: 20,
      duration_ms: 120000,
    });
    expect(result[1]).toMatchObject({ keystone_level: 19, duration_ms: 135000 });
  });

  it('returns [] when leading_groups is empty', () => {
    const empty = { ...base, leading_groups: [] };
    expect(transformLeaderboard(empty, 7, 11)).toEqual([]);
  });
});
