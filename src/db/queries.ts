import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import type { RankMatrixRow, WeeklyArcRow } from '../types.js';

export async function getSeasonRankMatrix(
  conn: AsyncDuckDBConnection,
  seasonId: number,
): Promise<RankMatrixRow[]> {
  const result = await conn.query(`
    SELECT dungeon_id::INTEGER AS dungeon_id,
           MEDIAN(keystone_level)::FLOAT AS median_key
    FROM leaderboard_${seasonId}
    GROUP BY dungeon_id
  `);
  return result.toArray().map(r => ({
    dungeon_id: Number(r.dungeon_id),
    season_id: seasonId,
    median_key: Number(r.median_key),
  }));
}

export async function getGlobalKeyRange(
  conn: AsyncDuckDBConnection,
  seasonIds: number[],
): Promise<{ minKey: number; maxKey: number }> {
  const unions = seasonIds
    .map(id => `SELECT MEDIAN(keystone_level) AS wm FROM leaderboard_${id} GROUP BY dungeon_id, period`)
    .join(' UNION ALL ');
  const result = await conn.query(
    `SELECT MIN(wm) AS min_key, MAX(wm) AS max_key FROM (${unions})`,
  );
  const row = result.toArray()[0];
  return { minKey: Number(row.min_key), maxKey: Number(row.max_key) };
}

export async function getWeeklyArc(
  conn: AsyncDuckDBConnection,
  dungeonId: number,
  seasonId: number,
): Promise<WeeklyArcRow[]> {
  const result = await conn.query(`
    SELECT period::INTEGER AS period,
           MEDIAN(keystone_level)::FLOAT AS median_key
    FROM leaderboard_${seasonId}
    WHERE dungeon_id = ${dungeonId}
    GROUP BY period
    ORDER BY period ASC
  `);
  return result.toArray().map((r, i) => ({
    period_index: i + 1,
    median_key: Number(r.median_key),
  }));
}
