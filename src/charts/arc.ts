import * as d3 from 'd3';
import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import { getWeeklyArc } from '../db/queries.js';
import { loadSeason } from '../db/init.js';
import { getState, setState, subscribe } from '../state.js';
import type { DungeonManifest, SeasonMeta, WeeklyArcRow } from '../types.js';

type ArcEntry = { season: SeasonMeta; rows: WeeklyArcRow[]; colorIndex: number };

const MARGIN = { top: 20, right: 140, bottom: 36, left: 44 };

let keyDomain: [number, number] = [0, 40];

export function setKeyDomain(min: number, max: number): void {
  keyDomain = [min, max];
}

export function initArc(
  container: HTMLElement,
  manifest: DungeonManifest,
  conn: AsyncDuckDBConnection,
): void {
  const emptyMsg = document.createElement('p');
  emptyMsg.style.cssText = 'margin:0;padding:16px;font-size:12px;color:#71717a;text-align:center';
  emptyMsg.textContent = 'Select a dungeon on the map or heatmap to see its weekly progression.';
  container.appendChild(emptyMsg);

  let lastDungeonId: number | null = null;
  let lastArcData: ArcEntry[] = [];

  subscribe(async state => {
    if (state.selectedDungeon === null) {
      lastDungeonId = null;
      lastArcData = [];
      container.replaceChildren(emptyMsg);
      return;
    }

    if (state.selectedDungeon !== lastDungeonId) {
      const dungeonAtStart = state.selectedDungeon;

      const activeSeasonsForDungeon = manifest.seasons
        .filter(s => s.dungeonIds.includes(dungeonAtStart))
        .sort((a, b) => a.id - b.id);

      lastArcData = await Promise.all(
        activeSeasonsForDungeon.map(async (s, i) => {
          await loadSeason(s.id);
          const rows = await getWeeklyArc(conn, dungeonAtStart, s.id);
          return { season: s, rows, colorIndex: i };
        }),
      );

      if (getState().selectedDungeon !== dungeonAtStart) return;
      lastDungeonId = dungeonAtStart;
    }

    const dungeon = manifest.dungeons.find(d => d.id === state.selectedDungeon);
    if (!dungeon) return;

    renderArc(container, dungeon.name, lastArcData, state.selectedSeasonForArc);
  });
}

const TITLE_H = 32;

function renderArc(
  container: HTMLElement,
  title: string,
  arcs: ArcEntry[],
  emphasizedSeasonId: number | null,
): void {
  container.replaceChildren();

  if (arcs.length === 0 || arcs.every(a => a.rows.length === 0)) return;

  const titleEl = document.createElement('div');
  titleEl.style.cssText =
    'padding:6px 12px 0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#71717a';
  titleEl.textContent = `${title} — Weekly Key Progression`;
  container.appendChild(titleEl);

  const colors = d3.schemeTableau10 as readonly string[];

  const width = container.clientWidth - MARGIN.left - MARGIN.right;
  const height = container.clientHeight - MARGIN.top - MARGIN.bottom - TITLE_H;

  const maxPeriods = Math.max(...arcs.map(a => a.rows.length));

  const xScale = d3.scaleLinear().domain([1, maxPeriods]).range([0, width]);
  const yScale = d3.scaleLinear().domain(keyDomain).range([height, 0]);

  const svg = d3.select(container)
    .append('svg')
    .attr('width', container.clientWidth)
    .attr('height', container.clientHeight - TITLE_H)
    .style('font-family', 'sans-serif');

  const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  // Axes
  g.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale).ticks(Math.min(maxPeriods, 10)).tickFormat(d => `W${d}`))
    .call(ax => ax.select('.domain').attr('stroke', '#3f3f46'))
    .call(ax => ax.selectAll('text').attr('fill', '#a1a1aa').attr('font-size', 10))
    .call(ax => ax.selectAll('line').attr('stroke', '#3f3f46'));

  g.append('g')
    .call(d3.axisLeft(yScale).ticks(5))
    .call(ax => ax.select('.domain').attr('stroke', '#3f3f46'))
    .call(ax => ax.selectAll('text').attr('fill', '#a1a1aa').attr('font-size', 10))
    .call(ax => ax.selectAll('line').attr('stroke', '#3f3f46'));

  // Y axis label
  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -34)
    .attr('text-anchor', 'middle')
    .attr('font-size', 10)
    .attr('fill', '#71717a')
    .text('Median Key');

  // Arc lines
  const line = d3.line<WeeklyArcRow>()
    .x(r => xScale(r.period_index))
    .y(r => yScale(r.median_key))
    .curve(d3.curveMonotoneX);

  for (const { season, rows, colorIndex } of arcs) {
    if (rows.length === 0) continue;
    const emphasized = emphasizedSeasonId === null || season.id === emphasizedSeasonId;
    g.append('path')
      .datum(rows)
      .attr('fill', 'none')
      .attr('stroke', colors[colorIndex % colors.length])
      .attr('stroke-width', emphasized ? 2.5 : 1.5)
      .attr('opacity', emphasized ? 1 : 0.3)
      .attr('d', line);
  }

  // Legend
  const legendG = svg.append('g')
    .attr('transform', `translate(${MARGIN.left + width + 8},${MARGIN.top})`);

  arcs.forEach(({ season, colorIndex }, i) => {
    const label = season.name.replace('Mythic+ Dungeons (', '').replace(')', '');
    const row = legendG.append('g')
      .attr('transform', `translate(0,${i * 18})`)
      .style('cursor', 'pointer')
      .on('click', () => setState({ selectedSeasonForArc: season.id }));

    row.append('circle')
      .attr('r', 5)
      .attr('cx', 5)
      .attr('cy', 0)
      .attr('fill', colors[colorIndex % colors.length])
      .attr('opacity', emphasizedSeasonId === null || season.id === emphasizedSeasonId ? 1 : 0.4);

    row.append('text')
      .attr('x', 14)
      .attr('y', 4)
      .attr('font-size', 10)
      .attr('fill', emphasizedSeasonId === null || season.id === emphasizedSeasonId ? '#e4e4e7' : '#71717a')
      .text(label);
  });
}
