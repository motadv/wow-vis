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
  median_key: number;
}

// Application state

export interface AppState {
  selectedDungeon: number | null;
  selectedSeasonForArc: number | null;  // which season's line is emphasized; null = all equal
  affixLens: 'trend' | 'snapshot' | 'headtohead';
  affixFilters: {
    dungeonId: number | null;       // lens 1 + 3
    seasonId: number | null;        // lens 2 + 3; defaults to selectedSeasonForArc
    fortified: boolean | null;      // lens 3 only; null = both
    secondaryAffixId: number | null; // lens 1 + 2; null = all weeks
  };
}
