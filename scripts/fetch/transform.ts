import type { BlizzardLeaderboard, LeaderboardEntry } from './types.js';

export function transformLeaderboard(
  raw: BlizzardLeaderboard,
  seasonId: number,
  realmId: number,
): LeaderboardEntry[] {
  const affixes = raw.keystone_affixes ?? [];
  const fortified = affixes.some(affix => affix.keystone_affix.id === 10);
  return raw.leading_groups.map(group => ({
    dungeon_id: raw.map_challenge_mode_id,
    season_id: seasonId,
    period: raw.period,
    realm_id: realmId,
    keystone_level: group.keystone_level,
    duration_ms: group.duration_ms,
    fortified,
  }));
}
