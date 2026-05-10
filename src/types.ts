// Shared types used by the in-browser viz

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
  era: Era;          // expansion of origin
  mapX: number;      // position on Azeroth world map (0-2048 range)
  mapY: number;
  offWorld: boolean; // true = off-world dungeon, render in off-world cluster
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
}

// Query result rows

export interface VolumeRow {
  dungeon_id: number;
  entry_count: number;
  min_key: number;
  median_key: number;
  max_key: number;
}

export interface KeyDistRow {
  keystone_level: number;
  count: number;
}

export interface CrossSeasonRow {
  season_id: number;
  entry_count: number;
  median_key: number;
}

// Application state

export interface AppState {
  selectedSeason: number;        // -1 = none selected
  selectedDungeon: number | null;
  viewMode: 'era' | 'reintroduction';
  filterEras: Era[];             // empty = all shown
}
