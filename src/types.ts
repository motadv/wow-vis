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

export interface AffixEntry {
  id: number;
  name: string;
}

export type AffixManifest = Record<number, Record<number, AffixEntry[]>>; // season → period → affixes

export interface DungeonManifest {
  dungeons: DungeonMeta[];
  seasons: SeasonMeta[];
  zones: ZoneMeta[];
}

// Query result rows

export interface RankMatrixRow {
  dungeon_id: number;
  season_id: number;
  median_key: number;
}

export interface WeeklyArcRow {
  period_index: number;  // 1-based, derived from ordering raw period IDs ascending
  period: number;        // raw period ID for affix lookup
  median_key: number;
}

export interface SecondaryAffixImpact {
  affixId: number;
  affixName: string;
  impactDelta: number;
}

export interface AffixMatrixRow {
  affixId: number;
  affixName: string;
  isPrimary: boolean;
  isFortified?: boolean;                    // set only on primary rows
  cells: Record<number, number | null>;     // seasonId → delta (null = dungeon not in season)
  avgDelta: number | null;                  // arithmetic mean across seasons with data; null = no data for this dungeon
}

export interface AffixMatrixData {
  dungeonId: number;
  seasonIds: number[];    // seasons where dungeon appears, ascending, pre-S13 only
  rows: AffixMatrixRow[]; // primary rows first, then secondary sorted by |avgDelta| desc
}

// Application state

export interface AppState {
  selectedDungeons: number[];
  selectedSeasonForArc: number | null;  // which season's line is emphasized; null = all equal
}
