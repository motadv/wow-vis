import type { BlizzardLeaderboard, LeaderboardEntry } from './types.js';

export function transformLeaderboard(
  raw: BlizzardLeaderboard,
  seasonId: number,
  realmId: number,
): LeaderboardEntry[] {
  return raw.leading_groups.map(group => ({
    dungeon_id: raw.map_challenge_mode_id,
    season_id: seasonId,
    period: raw.period,
    realm_id: realmId,
    keystone_level: group.keystone_level,
    duration_ms: group.duration_ms,
  }));
}
