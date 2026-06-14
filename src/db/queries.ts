import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import type { RankMatrixRow, WeeklyArcRow } from '../types.js';

export interface AffixTrendRow {
  season_id: number;
  fortified: boolean;
  median_key: number;
}

export interface AffixSnapshotRow {
  dungeon_id: number;
  fortified: boolean;
  median_key: number;
}

export interface AffixHeadToHeadRow {
  affix_id: number;
  median_key: number;
}

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

export async function getDungeonAffixTrend(
  conn: AsyncDuckDBConnection,
  dungeonId: number,
  seasonIds: number[],
  periodIds?: number[],
): Promise<AffixTrendRow[]> {
  const unions = seasonIds
    .map(id => {
      const where = periodIds ? `WHERE period IN (${periodIds.join(',')})` : '';
      return `SELECT ${id}::INTEGER AS season_id, fortified, MEDIAN(keystone_level)::FLOAT AS median_key FROM leaderboard_${id} WHERE dungeon_id = ${dungeonId} ${where} GROUP BY fortified`;
    })
    .join(' UNION ALL ');
  const result = await conn.query(unions);
  return result.toArray().map(r => ({
    season_id: Number(r.season_id),
    fortified: Boolean(r.fortified),
    median_key: Number(r.median_key),
  }));
}

export async function getSeasonAffixSnapshot(
  conn: AsyncDuckDBConnection,
  seasonId: number,
  periodIds?: number[],
): Promise<AffixSnapshotRow[]> {
  const where = periodIds ? `WHERE period IN (${periodIds.join(',')})` : '';
  const result = await conn.query(`
    SELECT dungeon_id::INTEGER AS dungeon_id,
           fortified,
           MEDIAN(keystone_level)::FLOAT AS median_key
    FROM leaderboard_${seasonId}
    ${where}
    GROUP BY dungeon_id, fortified
  `);
  return result.toArray().map(r => ({
    dungeon_id: Number(r.dungeon_id),
    fortified: Boolean(r.fortified),
    median_key: Number(r.median_key),
  }));
}

export async function getAffixHeadToHead(
  conn: AsyncDuckDBConnection,
  dungeonId: number,
  seasonId: number,
  periodIdsByAffix: Map<number, number[]>,
): Promise<AffixHeadToHeadRow[]> {
  const unions = Array.from(periodIdsByAffix.entries())
    .map(([affixId, periodIds]) =>
      `SELECT ${affixId}::INTEGER AS affix_id, MEDIAN(keystone_level)::FLOAT AS median_key FROM leaderboard_${seasonId} WHERE dungeon_id = ${dungeonId} AND period IN (${periodIds.join(',')}) GROUP BY period`,
    )
    .join(' UNION ALL ');
  const result = await conn.query(`
    SELECT affix_id, AVG(median_key)::FLOAT AS median_key
    FROM (${unions})
    GROUP BY affix_id
  `);
  return result.toArray().map(r => ({
    affix_id: Number(r.affix_id),
    median_key: Number(r.median_key),
  }));
}
