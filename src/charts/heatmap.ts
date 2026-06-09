import * as d3 from 'd3';
import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import { ERA_PALETTE } from '../config.js';
import { getSeasonRankMatrix } from '../db/queries.js';
import { loadSeason } from '../db/init.js';
import { computeRanks } from '../utils/ranks.js';
import { setState, subscribe } from '../state.js';
import type { DungeonManifest, DungeonMeta, RankMatrixRow } from '../types.js';

const LABEL_W = 160;
const CELL_H = 18;
const HEADER_H = 64;

type CellInfo = { rank: number; total: number; median_key: number };

export async function initHeatmap(
  container: HTMLElement,
  manifest: DungeonManifest,
  conn: AsyncDuckDBConnection,
): Promise<void> {
  const seasons = manifest.seasons
    .filter(s => s.dungeonIds.length > 0)
    .sort((a, b) => a.id - b.id);

  container.textContent = 'Loading…';

  await Promise.all(seasons.map(s => loadSeason(s.id)));

  const rawRows: RankMatrixRow[] = [];
  for (const s of seasons) {
    const rows = await getSeasonRankMatrix(conn, s.id);
    rawRows.push(...rows);
  }

  const ranked = computeRanks(rawRows);

  const lookup = new Map<number, Map<number, CellInfo>>();
  for (const r of ranked) {
    if (!lookup.has(r.dungeon_id)) lookup.set(r.dungeon_id, new Map());
    lookup.get(r.dungeon_id)!.set(r.season_id, {
      rank: r.rank,
      total: r.total,
      median_key: r.median_key,
    });
  }

  function normalizedValue(info: CellInfo): number {
    return info.total === 1 ? 1 : 1 - (info.rank - 1) / (info.total - 1);
  }

  const dungeonIds = [...lookup.keys()];
  dungeonIds.sort((a, b) => {
    const mean = (id: number) => {
      const vals = [...lookup.get(id)!.values()];
      return vals.reduce((acc, v) => acc + normalizedValue(v), 0) / vals.length;
    };
    return mean(b) - mean(a);
  });

  const dungeons = dungeonIds
    .map(id => manifest.dungeons.find(d => d.id === id))
    .filter((d): d is DungeonMeta => d !== undefined);

  container.textContent = '';

  const CELL_W = Math.max(28, Math.floor((container.clientWidth - LABEL_W - 12) / seasons.length));
  const svgW = LABEL_W + seasons.length * CELL_W + 10;
  const svgH = HEADER_H + dungeons.length * CELL_H + 10;

  const colorScale = d3.scaleSequential(d3.interpolateBlues).domain([0, 1]);

  const svg = d3.select(container)
    .append('svg')
    .attr('width', svgW)
    .attr('height', svgH)
    .style('font-family', 'sans-serif');

  // Season column headers — rotated −45°
  seasons.forEach((season, si) => {
    const x = LABEL_W + si * CELL_W + CELL_W / 2;
    const y = HEADER_H - 6;
    const label = season.name.replace('Mythic+ Dungeons (', '').replace(')', '');
    svg.append('text')
      .attr('x', x)
      .attr('y', y)
      .attr('text-anchor', 'start')
      .attr('font-size', 10)
      .attr('fill', '#a1a1aa')
      .attr('transform', `rotate(-45,${x},${y})`)
      .text(label);
  });

  // Dungeon rows
  const rows = svg.selectAll<SVGGElement, DungeonMeta>('.dungeon-row')
    .data(dungeons, d => d.id)
    .enter()
    .append('g')
    .attr('class', 'dungeon-row')
    .attr('transform', (_, i) => `translate(0,${HEADER_H + i * CELL_H})`);

  // Dungeon name labels
  rows.append('text')
    .attr('x', LABEL_W - 6)
    .attr('y', CELL_H / 2 + 4)
    .attr('text-anchor', 'end')
    .attr('font-size', 10)
    .attr('fill', d => ERA_PALETTE[d.era])
    .text(d => d.name);

  // Cells — one per season per row
  seasons.forEach((season, si) => {
    rows.append('rect')
      .attr('x', LABEL_W + si * CELL_W)
      .attr('y', 1)
      .attr('width', CELL_W - 1)
      .attr('height', CELL_H - 2)
      .attr('rx', 2)
      .attr('fill', d => {
        const info = lookup.get(d.id)?.get(season.id);
        if (!info) return '#27272a';
        return colorScale(normalizedValue(info));
      })
      .style('cursor', d => lookup.get(d.id)?.has(season.id) ? 'pointer' : 'default')
      .on('click', (_, d) => {
        if (!lookup.get(d.id)?.has(season.id)) return;
        setState({ selectedDungeon: d.id, selectedSeasonForArc: season.id });
      })
      .append('title')
      .text(d => {
        const info = lookup.get(d.id)?.get(season.id);
        if (!info) return `${d.name} — not in ${season.name}`;
        const label = season.name.replace('Mythic+ Dungeons (', '').replace(')', '');
        return `${d.name}\n${label}\nMedian key: ${info.median_key.toFixed(1)}\nRank ${info.rank} of ${info.total}`;
      });
  });

  // Highlight selected dungeon row
  subscribe(state => {
    svg.selectAll<SVGGElement, DungeonMeta>('.dungeon-row')
      .attr('opacity', d =>
        state.selectedDungeon === null || d.id === state.selectedDungeon ? 1 : 0.4
      );
  });
}
