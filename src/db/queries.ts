import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import type { RankMatrixRow, WeeklyArcRow } from '../types.js';
import { getAffixManifest } from './init.js';

// Mediana por dungeon por season — usada pelo Dungeon Browser para ordenar tiles (T1).
// Mediana é robusta a outliers: grupos em níveis muito altos ou baixos não distorcem
// a estimativa central do desempenho da comunidade (§1.2 do relatório).
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

// Calcula o domínio global do eixo Y do Arc Chart sobre todas as seasons carregadas.
// A escala é fixada uma vez e compartilhada entre todos os modos de renderização
// para garantir comparabilidade visual sem distorção (§4.4 do relatório).
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

// Série temporal semanal de uma dungeon em uma season específica.
// period_index é relativo ao início da season (1 = primeira semana),
// não o ID absoluto de período — permite sobrepor seasons de durações diferentes
// no mesmo espaço visual do Arc Chart (§4.4 do relatório).
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
    period: Number(r.period),
    median_key: Number(r.median_key),
  }));
}

// Versão agregada sem filtro de dungeon — usada no estado "sem dungeon selecionada"
// para exibir o comportamento médio de todas as dungeons na season.
export async function getWeeklyArcAllDungeons(
  conn: AsyncDuckDBConnection,
  seasonId: number,
): Promise<WeeklyArcRow[]> {
  const result = await conn.query(`
    SELECT period::INTEGER AS period,
           MEDIAN(keystone_level)::FLOAT AS median_key
    FROM leaderboard_${seasonId}
    GROUP BY period
    ORDER BY period ASC
  `);
  return result.toArray().map((r, i) => ({
    period_index: i + 1,
    period: Number(r.period),
    median_key: Number(r.median_key),
  }));
}

// Calcula o delta de impacto de cada afixo secundário na dungeon/season dada (T5).
// Lógica: baseline = mediana global da season; delta = mediana nas semanas com o afixo − baseline.
// Delta positivo → afixo associado a semanas mais fáceis; negativo → mais difíceis.
// Isso é correlação, não causalidade (§1.2 do relatório).
export async function getSecondaryAffixImpact(
  conn: AsyncDuckDBConnection,
  dungeonId: number | null,
  seasonId: number,
  periodIds?: number[],
): Promise<Array<{ affixId: number; affixName: string; impactDelta: number }>> {
  const manifest = getAffixManifest();
  const allPeriods = periodIds || Object.keys(manifest[seasonId] || {}).map(Number);

  if (allPeriods.length === 0) return [];

  const dungeonFilter = dungeonId !== null ? `dungeon_id = ${dungeonId} AND ` : '';

  // Baseline: mediana de todas as semanas da season (sem filtro de afixo).
  const baselineQuery = `
    SELECT MEDIAN(keystone_level) as baseline
    FROM leaderboard_${seasonId}
    WHERE ${dungeonFilter}period IN (${allPeriods.join(',')})
  `;
  const baselineResult = await conn.query(baselineQuery);
  const baseline = (baselineResult.toArray()[0]?.baseline as number) || 0;

  // Coleta afixos secundários (exclui Fortified=10 e Tyrannical=9 que são primários).
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
    // Semanas em que este afixo esteve ativo — fonte: manifesto affixes.json.
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
      WHERE ${dungeonFilter}period IN (${affixPeriods.join(',')})
    `;
    const withAffixResult = await conn.query(withAffixQuery);
    const withAffixMedian = (withAffixResult.toArray()[0]?.median_key as number) || 0;

    const impactDelta = withAffixMedian - baseline;
    results.push({ affixId, affixName, impactDelta });
  }

  // Ordena por magnitude do delta para que afixos mais impactantes apareçam primeiro.
  return results.sort((a, b) => Math.abs(b.impactDelta) - Math.abs(a.impactDelta));
}

// Agrega impacto de afixos secundários em múltiplas seasons — gera a estrutura
// de células (seasonId → delta) para o heatmap do Affix Chart (§3.3 do relatório).
export async function getSecondaryAffixImpactAllSeasons(
  conn: AsyncDuckDBConnection,
  dungeonId: number | null,
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
    // avgDelta = Σ(delta_por_season) / n_seasons (§3.3 do relatório).
    const avgDelta = values.reduce((a, b) => a + b, 0) / values.length;
    return { affixId, affixName: data.name, cells: data.cells, avgDelta };
  });
}

// Delta dos afixos primários (Fortified vs Tyrannical) por season (T6).
// Uma única query SQL calcula baseline, fort_median e tyrant_median de uma vez
// usando CASE WHEN para evitar múltiplos round-trips ao DuckDB.
export async function getPrimaryAffixDeltaBySeason(
  conn: AsyncDuckDBConnection,
  dungeonId: number | null,
  seasonIds: number[],
): Promise<Array<{ seasonId: number; fortifiedDelta: number; tyrannicalDelta: number }>> {
  const whereClause = dungeonId !== null ? `WHERE dungeon_id = ${dungeonId}` : '';
  return Promise.all(
    seasonIds.map(async seasonId => {
      const result = await conn.query(`
        SELECT
          MEDIAN(keystone_level)::FLOAT                                   AS baseline,
          MEDIAN(CASE WHEN fortified     THEN keystone_level END)::FLOAT  AS fort_median,
          MEDIAN(CASE WHEN NOT fortified THEN keystone_level END)::FLOAT  AS tyrant_median
        FROM leaderboard_${seasonId}
        ${whereClause}
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
