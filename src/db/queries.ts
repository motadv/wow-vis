import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import type { VolumeRow, KeyDistRow, CrossSeasonRow } from '../types.js';

export async function getVolumeRows(
  conn: AsyncDuckDBConnection,
  seasonId: number,
): Promise<VolumeRow[]> {
  const result = await conn.query(`
    SELECT
      dungeon_id,
      COUNT(*) AS entry_count,
      MIN(keystone_level) AS min_key,
      MEDIAN(keystone_level) AS median_key,
      MAX(keystone_level) AS max_key
    FROM leaderboard_${seasonId}
    GROUP BY dungeon_id
  `);

  const rows: VolumeRow[] = [];
  for (const batch of result.batches) {
    for (let i = 0; i < batch.numRows; i++) {
      rows.push({
        dungeon_id: Number(batch.getChildAt(0)?.get(i)),
        entry_count: Number(batch.getChildAt(1)?.get(i)),
        min_key: Number(batch.getChildAt(2)?.get(i)),
        median_key: Number(batch.getChildAt(3)?.get(i)),
        max_key: Number(batch.getChildAt(4)?.get(i)),
      });
    }
  }
  return rows;
}

export async function getKeyDistribution(
  conn: AsyncDuckDBConnection,
  seasonId: number,
  dungeonId: number,
): Promise<KeyDistRow[]> {
  const result = await conn.query(`
    SELECT keystone_level, COUNT(*) AS count
    FROM leaderboard_${seasonId}
    WHERE dungeon_id = ${dungeonId}
    GROUP BY keystone_level
    ORDER BY keystone_level ASC
  `);

  const rows: KeyDistRow[] = [];
  for (const batch of result.batches) {
    for (let i = 0; i < batch.numRows; i++) {
      rows.push({
        keystone_level: Number(batch.getChildAt(0)?.get(i)),
        count: Number(batch.getChildAt(1)?.get(i)),
      });
    }
  }
  return rows;
}

export async function getCrossSeasonVolume(
  conn: AsyncDuckDBConnection,
  dungeonId: number,
  seasonIds: number[],
): Promise<CrossSeasonRow[]> {
  if (seasonIds.length === 0) return [];

  const unions = seasonIds.map(id =>
    `SELECT ${id} AS season_id, keystone_level, entry_count FROM (
       SELECT keystone_level, COUNT(*) AS entry_count
       FROM leaderboard_${id}
       WHERE dungeon_id = ${dungeonId}
       GROUP BY keystone_level
     )`,
  ).join('\nUNION ALL\n');

  const result = await conn.query(`
    SELECT
      season_id,
      SUM(entry_count) AS entry_count,
      MEDIAN(keystone_level) AS median_key
    FROM (${unions})
    GROUP BY season_id
    ORDER BY season_id ASC
  `);

  const rows: CrossSeasonRow[] = [];
  for (const batch of result.batches) {
    for (let i = 0; i < batch.numRows; i++) {
      rows.push({
        season_id: Number(batch.getChildAt(0)?.get(i)),
        entry_count: Number(batch.getChildAt(1)?.get(i)),
        median_key: Number(batch.getChildAt(2)?.get(i)),
      });
    }
  }
  return rows;
}
