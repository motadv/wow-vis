import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import type { RankMatrixRow, WeeklyArcRow } from '../types.js';
import { getAffixManifest } from './init.js';

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
      const periodFilter = periodIds ? `AND period IN (${periodIds.join(',')})` : '';
      return `SELECT ${id}::INTEGER AS season_id, fortified, MEDIAN(keystone_level)::FLOAT AS median_key FROM leaderboard_${id} WHERE dungeon_id = ${dungeonId} ${periodFilter} GROUP BY fortified`;
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

export async function getSecondaryAffixImpact(
  conn: AsyncDuckDBConnection,
  dungeonId: number,
  seasonId: number,
  periodIds?: number[],
): Promise<Array<{ affixId: number; affixName: string; impactDelta: number }>> {
  const manifest = getAffixManifest();
  const allPeriods = periodIds || Object.keys(manifest[seasonId] || {}).map(Number);

  if (allPeriods.length === 0) return [];

  const baselineQuery = `
    SELECT MEDIAN(keystone_level) as baseline
    FROM leaderboard_${seasonId}
    WHERE dungeon_id = ${dungeonId} AND period IN (${allPeriods.join(',')})
  `;
  const baselineResult = await conn.query(baselineQuery);
  const baseline = (baselineResult.toArray()[0]?.baseline as number) || 0;

  const affixSet = new Map<number, string>();
  for (const affixes of Object.values(manifest[seasonId] || {})) {
    for (const affix of affixes) {
      if (affix.id !== 10 && affix.id !== 9) {
        affixSet.set(affix.id, affix.name);
      }
    }
  }

  const results: Array<{ affixId: number; affixName: string; impactDelta: number }> = [];

  for (const [affixId, affixName] of affixSet.entries()) {
    const affixPeriods: number[] = [];
    for (const [periodId, affixes] of Object.entries(manifest[seasonId] || {})) {
      if (affixes.some(a => a.id === affixId)) {
        affixPeriods.push(Number(periodId));
      }
    }

    if (affixPeriods.length === 0) continue;

    const withAffixQuery = `
      SELECT MEDIAN(keystone_level) as median_key
      FROM leaderboard_${seasonId}
      WHERE dungeon_id = ${dungeonId} AND period IN (${affixPeriods.join(',')})
    `;
    const withAffixResult = await conn.query(withAffixQuery);
    const withAffixMedian = (withAffixResult.toArray()[0]?.median_key as number) || 0;

    const impactDelta = withAffixMedian - baseline;
    results.push({ affixId, affixName, impactDelta });
  }

  return results.sort((a, b) => Math.abs(b.impactDelta) - Math.abs(a.impactDelta));
}

export async function getAggregateSecondaryAffixImpact(
  conn: AsyncDuckDBConnection,
  dungeonIds: number[],
  seasonId: number,
  periodIds?: number[],
): Promise<Array<{ affixId: number; affixName: string; averageImpactDelta: number }>> {
  const dungeonImpacts = await Promise.all(
    dungeonIds.map(dId => getSecondaryAffixImpact(conn, dId, seasonId, periodIds)),
  );

  const affixMap = new Map<number, { name: string; deltas: number[] }>();

  for (const impacts of dungeonImpacts) {
    for (const impact of impacts) {
      if (!affixMap.has(impact.affixId)) {
        affixMap.set(impact.affixId, { name: impact.affixName, deltas: [] });
      }
      affixMap.get(impact.affixId)!.deltas.push(impact.impactDelta);
    }
  }

  const results = Array.from(affixMap.entries()).map(([affixId, data]) => ({
    affixId,
    affixName: data.name,
    averageImpactDelta: data.deltas.reduce((a, b) => a + b, 0) / data.deltas.length,
  }));

  return results.sort((a, b) => Math.abs(b.averageImpactDelta) - Math.abs(a.averageImpactDelta));
}

export async function getPrimaryAffixTrend(
  conn: AsyncDuckDBConnection,
  dungeonIds: number[],
  seasonId: number,
): Promise<Array<{ period: number; fortifiedMedian: number; tyrannicalMedian: number; combinedMedian?: number }>> {
  const dungeonClause = dungeonIds.length === 1
    ? `dungeon_id = ${dungeonIds[0]}`
    : `dungeon_id IN (${dungeonIds.join(',')})`;

  const query = `
    SELECT
      period::INTEGER AS period,
      fortified,
      MEDIAN(keystone_level)::FLOAT AS median_key
    FROM leaderboard_${seasonId}
    WHERE ${dungeonClause}
    GROUP BY period, fortified
    ORDER BY period ASC
  `;

  const result = await conn.query(query);
  const rows = result.toArray().map(r => ({
    period: Number(r.period),
    fortified: Boolean(r.fortified),
    median_key: Number(r.median_key),
  }));

  const periodMap = new Map<number, { fortifiedMedian: number; tyrannicalMedian: number }>();
  for (const row of rows) {
    if (!periodMap.has(row.period)) {
      periodMap.set(row.period, { fortifiedMedian: 0, tyrannicalMedian: 0 });
    }
    const entry = periodMap.get(row.period)!;
    if (row.fortified) {
      entry.fortifiedMedian = row.median_key;
    } else {
      entry.tyrannicalMedian = row.median_key;
    }
  }

  return Array.from(periodMap.entries()).map(([period, data]) => ({
    period,
    ...data,
  }));
}

export async function getSecondaryAffixImpactAllSeasons(
  conn: AsyncDuckDBConnection,
  dungeonId: number,
  seasonIds: number[],
): Promise<Array<{ affixId: number; affixName: string; cells: Record<number, number>; avgDelta: number }>> {
  const perSeason = await Promise.all(
    seasonIds.map(async seasonId => ({
      seasonId,
      impacts: await getSecondaryAffixImpact(conn, dungeonId, seasonId),
    })),
  );

  const affixMap = new Map<number, { name: string; cells: Record<number, number> }>();
  for (const { seasonId, impacts } of perSeason) {
    for (const { affixId, affixName, impactDelta } of impacts) {
      if (!affixMap.has(affixId)) {
        affixMap.set(affixId, { name: affixName, cells: {} });
      }
      affixMap.get(affixId)!.cells[seasonId] = impactDelta;
    }
  }

  return Array.from(affixMap.entries()).map(([affixId, data]) => {
    const values = Object.values(data.cells);
    const avgDelta = values.reduce((a, b) => a + b, 0) / values.length;
    return { affixId, affixName: data.name, cells: data.cells, avgDelta };
  });
}

export async function getPrimaryAffixDeltaBySeason(
  conn: AsyncDuckDBConnection,
  dungeonId: number,
  seasonIds: number[],
): Promise<Array<{ seasonId: number; fortifiedDelta: number; tyrannicalDelta: number }>> {
  return Promise.all(
    seasonIds.map(async seasonId => {
      const result = await conn.query(`
        SELECT
          MEDIAN(keystone_level)::FLOAT                                   AS baseline,
          MEDIAN(CASE WHEN fortified     THEN keystone_level END)::FLOAT  AS fort_median,
          MEDIAN(CASE WHEN NOT fortified THEN keystone_level END)::FLOAT  AS tyrant_median
        FROM leaderboard_${seasonId}
        WHERE dungeon_id = ${dungeonId}
      `);
      const row = result.toArray()[0];
      const baseline = Number(row.baseline);
      return {
        seasonId,
        fortifiedDelta:  Number(row.fort_median)   - baseline,
        tyrannicalDelta: Number(row.tyrant_median) - baseline,
      };
    }),
  );
}
