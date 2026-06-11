// Shared types used by the offline data pipeline

export type Era =
  | 'vanilla'
  | 'tbc'
  | 'wotlk'
  | 'cataclysm'
  | 'mop'
  | 'wod'
  | 'legion'
  | 'bfa'
  | 'shadowlands'
  | 'dragonflight'
  | 'tww'
  | 'midnight';

export interface DungeonMeta {
  id: number;        // map_challenge_mode_id
  name: string;
  abbrev: string;    // short tile label, 2–5 chars, unique across all dungeons
  era: Era;          // expansion of origin
  zone: string;      // overworld zone slug — matches ZoneMeta.slug
  offWorld: boolean; // true = off-world dungeon, render in off-world cluster
}

export interface ZoneMeta {
  slug: string;
  x: number;         // anchor on world map image (0-3840)
  y: number;         // anchor on world map image (0-2560)
}

export interface SeasonMeta {
  id: number;
  name: string;
  startTimestamp: number;
  dungeonIds: number[]; // map_challenge_mode_ids active in this season
}

export interface DungeonManifest {
  dungeons: DungeonMeta[];
  seasons: SeasonMeta[];
  zones: ZoneMeta[];
}

// Parquet row — snake_case to match column names
export interface LeaderboardEntry {
  dungeon_id: number;   // map_challenge_mode_id
  season_id: number;
  period: number;
  realm_id: number;
  keystone_level: number;
  duration_ms: number;
}

// Raw Blizzard API shapes

export interface BlizzardSeasonRef {
  key: { href: string };
  id: number;
}

export interface BlizzardSeason {
  id: number;
  start_timestamp: number;
  end_timestamp?: number;
  season_name: string | null;
  periods: BlizzardSeasonRef[];
}

export interface BlizzardSeasonIndex {
  seasons: BlizzardSeasonRef[];
  current_season: BlizzardSeasonRef;
}

export interface BlizzardLeaderboardRef {
  key: { href: string };
  name: string;
  id: number; // map_challenge_mode_id
}

export interface BlizzardLeaderboardIndex {
  current_leaderboards: BlizzardLeaderboardRef[];
}

export interface BlizzardLeaderboardGroup {
  ranking: number;
  duration_ms: number;
  completed_timestamp: number;
  keystone_level: number;
  members: unknown[];
}

export interface BlizzardLeaderboard {
  map_challenge_mode_id: number; // challenge mode ID from the URL, not map.id
  name: string;
  map: { name: string; id: number };
  period: number;
  leading_groups: BlizzardLeaderboardGroup[];
}
