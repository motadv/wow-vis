import * as d3 from 'd3';
import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import { getWeeklyArc } from '../db/queries.js';
import { loadSeason } from '../db/init.js';
import { getState, subscribe } from '../state.js';
import type { DungeonManifest, SeasonMeta, WeeklyArcRow } from '../types.js';

type ArcEntry = { season: SeasonMeta; rows: WeeklyArcRow[]; colorIndex: number };

const MARGIN = { top: 20, right: 60, bottom: 50, left: 44 };

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

const TITLE_H = 48;

function renderArc(
  container: HTMLElement,
  title: string,
  arcs: ArcEntry[],
  emphasizedSeasonId: number | null,
): void {
  container.replaceChildren();
  if (arcs.length === 0 || arcs.every(a => a.rows.length === 0)) return;

  container.style.position = 'relative';

  const titleEl = document.createElement('div');
  titleEl.style.cssText =
    'padding:14px 16px 0;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#e4e4e7';
  titleEl.textContent = `${title} — Median Key Level per Week`;
  container.appendChild(titleEl);

  const colors = d3.schemeTableau10 as readonly string[];
  const width = container.clientWidth - MARGIN.left - MARGIN.right;
  const height = container.clientHeight - MARGIN.top - MARGIN.bottom - TITLE_H;
  const maxPeriods = Math.max(...arcs.map(a => a.rows.length));

  const xScale = d3.scaleLinear().domain([1, maxPeriods]).range([0, width]);
  const yScale = d3.scaleLinear().domain(keyDomain).range([height, 0]);

  const line = d3.line<WeeklyArcRow>()
    .x(r => xScale(r.period_index))
    .y(r => yScale(r.median_key))
    .curve(d3.curveMonotoneX);

  const svg = d3.select(container)
    .append('svg')
    .attr('width', container.clientWidth)
    .attr('height', container.clientHeight - TITLE_H)
    .style('font-family', 'sans-serif');

  const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  drawAxes(g, xScale, yScale, height, width);
  drawLines(g, arcs, xScale, yScale, height, emphasizedSeasonId, colors, line);
  drawTooltip(g, arcs, xScale, width, height, emphasizedSeasonId, colors, container);
}

function drawAxes(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  height: number,
  width: number,
): void {
  const maxPeriods = Math.round(xScale.domain()[1]);

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

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -34)
    .attr('text-anchor', 'middle')
    .attr('font-size', 10)
    .attr('fill', '#71717a')
    .text('Median Key');

  // width used in Task 2
  void width;
}

function drawLines(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  arcs: ArcEntry[],
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  height: number,
  emphasizedSeasonId: number | null,
  colors: readonly string[],
  line: d3.Line<WeeklyArcRow>,
): void {
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

    // xScale, yScale, height, season used in Task 3
    void xScale; void yScale; void height; void season;
  }
}

function drawTooltip(
  _g: d3.Selection<SVGGElement, unknown, null, undefined>,
  _arcs: ArcEntry[],
  _xScale: d3.ScaleLinear<number, number>,
  _width: number,
  _height: number,
  _emphasizedSeasonId: number | null,
  _colors: readonly string[],
  _container: HTMLElement,
): void {}

