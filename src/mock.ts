import type { DungeonManifest, VolumeRow, KeyDistRow } from './types';

function makeDist(min: number, median: number, max: number, total: number): KeyDistRow[] {
  const rows: KeyDistRow[] = [];
  for (let k = min; k <= max; k++) {
    const d = Math.abs(k - median);
    rows.push({ keystone_level: k, count: Math.max(1, Math.round(total * Math.exp(-d * 0.45) / (max - min + 1))) });
  }
  return rows;
}

// Coordinates are in 2048×1400 SVG viewBox space (map.webp 1000×667 scaled to fill it, factor ≈2.05×/2.10×).
// EK spans roughly x=1065–1450; Northrend spans roughly x=310–1230, y=0–290 (top strip).
export const MOCK_MANIFEST: DungeonManifest = {
  dungeons: [
    { id: 101, name: 'Deadmines',                era: 'vanilla',      mapX: 1150, mapY: 755,  offWorld: false },
    { id: 102, name: 'Shadowfang Keep',           era: 'vanilla',      mapX: 1100, mapY: 450,  offWorld: false },
    { id: 103, name: 'The Nexus',                 era: 'wotlk',        mapX: 440,  mapY: 190,  offWorld: false },
    { id: 104, name: 'Halls of Stone',            era: 'wotlk',        mapX: 900,  mapY: 135,  offWorld: false },
    { id: 105, name: 'Blackrock Caverns',         era: 'cataclysm',    mapX: 1220, mapY: 680,  offWorld: false },
    { id: 106, name: 'Throne of the Tides',       era: 'cataclysm',    mapX: 1000, mapY: 900,  offWorld: false },
    { id: 107, name: 'Black Rook Hold',           era: 'legion',       mapX: 0,    mapY: 0,    offWorld: true  },
    { id: 108, name: 'Eye of Azshara',            era: 'legion',       mapX: 0,    mapY: 0,    offWorld: true  },
    { id: 109, name: 'Ruby Life Pools',           era: 'dragonflight', mapX: 0,    mapY: 0,    offWorld: true  },
    { id: 110, name: "Algeth'ar Academy",         era: 'dragonflight', mapX: 0,    mapY: 0,    offWorld: true  },
    { id: 111, name: 'Ara-Kara, City of Echoes',  era: 'tww',          mapX: 0,    mapY: 0,    offWorld: true  },
    { id: 112, name: 'City of Threads',           era: 'tww',          mapX: 0,    mapY: 0,    offWorld: true  },
  ],
  seasons: [
    {
      id: 1,
      name: 'Season 13 — Dragonflight',
      startTimestamp: 1_690_000_000,
      dungeonIds: [101, 102, 103, 104, 107, 108, 109, 110],
    },
    {
      id: 2,
      name: 'Season 1 — The War Within',
      startTimestamp: 1_720_000_000,
      dungeonIds: [103, 104, 105, 106, 107, 108, 111, 112],
    },
  ],
};

export const MOCK_VOLUME: Record<number, VolumeRow[]> = {
  1: [
    { dungeon_id: 101, entry_count: 312, min_key: 15, median_key: 22, max_key: 28 },
    { dungeon_id: 102, entry_count: 287, min_key: 14, median_key: 21, max_key: 27 },
    { dungeon_id: 103, entry_count: 445, min_key: 17, median_key: 24, max_key: 31 },
    { dungeon_id: 104, entry_count: 398, min_key: 16, median_key: 23, max_key: 30 },
    { dungeon_id: 107, entry_count: 521, min_key: 18, median_key: 25, max_key: 32 },
    { dungeon_id: 108, entry_count: 489, min_key: 17, median_key: 24, max_key: 31 },
    { dungeon_id: 109, entry_count: 476, min_key: 18, median_key: 25, max_key: 32 },
    { dungeon_id: 110, entry_count: 432, min_key: 16, median_key: 23, max_key: 30 },
  ],
  2: [
    { dungeon_id: 103, entry_count: 367, min_key: 16, median_key: 23, max_key: 29 },
    { dungeon_id: 104, entry_count: 341, min_key: 15, median_key: 22, max_key: 28 },
    { dungeon_id: 105, entry_count: 298, min_key: 14, median_key: 21, max_key: 27 },
    { dungeon_id: 106, entry_count: 312, min_key: 15, median_key: 21, max_key: 27 },
    { dungeon_id: 107, entry_count: 543, min_key: 19, median_key: 26, max_key: 33 },
    { dungeon_id: 108, entry_count: 501, min_key: 18, median_key: 25, max_key: 32 },
    { dungeon_id: 111, entry_count: 489, min_key: 18, median_key: 25, max_key: 32 },
    { dungeon_id: 112, entry_count: 512, min_key: 19, median_key: 26, max_key: 33 },
  ],
};

export const MOCK_KEY_DIST: Record<number, Record<number, KeyDistRow[]>> = {
  1: {
    101: makeDist(15, 22, 28, 312),
    102: makeDist(14, 21, 27, 287),
    103: makeDist(17, 24, 31, 445),
    104: makeDist(16, 23, 30, 398),
    107: makeDist(18, 25, 32, 521),
    108: makeDist(17, 24, 31, 489),
    109: makeDist(18, 25, 32, 476),
    110: makeDist(16, 23, 30, 432),
  },
  2: {
    103: makeDist(16, 23, 29, 367),
    104: makeDist(15, 22, 28, 341),
    105: makeDist(14, 21, 27, 298),
    106: makeDist(15, 21, 27, 312),
    107: makeDist(19, 26, 33, 543),
    108: makeDist(18, 25, 32, 501),
    111: makeDist(18, 25, 32, 489),
    112: makeDist(19, 26, 33, 512),
  },
};
