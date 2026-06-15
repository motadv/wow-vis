import * as d3 from 'd3';
import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import { getWeeklyArc } from '../db/queries.js';
import { loadSeason } from '../db/init.js';
import { getState, setState, subscribe } from '../state.js';
import { MAX_SEASON } from '../config.js';
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
        .filter(s => s.dungeonIds.includes(dungeonAtStart) && s.id <= MAX_SEASON)
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
    'padding:14px 16px 0;display:flex;align-items:center;justify-content:space-between;';

  const titleText = document.createElement('span');
  titleText.style.cssText = 'font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#e4e4e7';
  titleText.textContent = `${title} — Median Key Level per Week`;
  titleEl.appendChild(titleText);

  if (emphasizedSeasonId !== null) {
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'View All';
    resetBtn.style.cssText = `
      padding:4px 10px;
      font-size:11px;
      border:1px solid #666;
      background:transparent;
      color:#999;
      border-radius:3px;
      cursor:pointer;
      transition:all 0.2s ease;
      font-weight:600;
    `;
    resetBtn.onmouseover = () => {
      resetBtn.style.borderColor = '#8b5cf6';
      resetBtn.style.color = '#c4b5fd';
    };
    resetBtn.onmouseout = () => {
      resetBtn.style.borderColor = '#666';
      resetBtn.style.color = '#999';
    };
    resetBtn.onclick = () => {
      setState({ selectedSeasonForArc: null });
    };
    titleEl.appendChild(resetBtn);
  }

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
  drawTooltip(g, arcs, xScale, yScale, width, height, emphasizedSeasonId, colors, container);
}

function drawAxes(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  height: number,
  width: number,
): void {
  const maxPeriods = Math.round(xScale.domain()[1]);

  // Horizontal grid lines — drawn first so they appear behind everything
  yScale.ticks(5).forEach(tick => {
    g.append('line')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', yScale(tick)).attr('y2', yScale(tick))
      .attr('stroke', '#27272a')
      .attr('stroke-width', 1)
      .style('pointer-events', 'none');
  });

  g.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale).ticks(Math.min(maxPeriods, 10)).tickFormat(d => `W${d}`))
    .call(ax => ax.select('.domain').attr('stroke', '#3f3f46'))
    .call(ax => ax.selectAll('text').attr('fill', '#a1a1aa').attr('font-size', 12))
    .call(ax => ax.selectAll('line').attr('stroke', '#3f3f46'));

  g.append('g')
    .call(d3.axisLeft(yScale).ticks(5))
    .call(ax => ax.select('.domain').attr('stroke', '#3f3f46'))
    .call(ax => ax.selectAll('text').attr('fill', '#a1a1aa').attr('font-size', 12))
    .call(ax => ax.selectAll('line').attr('stroke', '#3f3f46'));

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -34)
    .attr('text-anchor', 'middle')
    .attr('font-size', 12)
    .attr('fill', '#71717a')
    .text('Median Key');

  g.append('text')
    .attr('x', width / 2)
    .attr('y', height + 38)
    .attr('text-anchor', 'middle')
    .attr('font-size', 12)
    .attr('fill', '#71717a')
    .text('Week of Season');
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
    const color = colors[colorIndex % colors.length];

    g.append('path')
      .datum(rows)
      .attr('data-season-id', String(season.id))
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', emphasized ? 2.5 : 1.5)
      .attr('opacity', emphasized ? 1 : 0.3)
      .attr('d', line);

    for (const row of rows) {
      g.append('circle')
        .attr('cx', xScale(row.period_index))
        .attr('cy', yScale(row.median_key))
        .attr('r', 3)
        .attr('fill', color)
        .attr('opacity', emphasized ? 1 : 0.3)
        .style('pointer-events', 'none');
    }

    const lastRow = rows[rows.length - 1];
    const endX = xScale(lastRow.period_index);

    g.append('line')
      .attr('x1', endX).attr('x2', endX)
      .attr('y1', 0).attr('y2', height)
      .attr('stroke', color)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3')
      .attr('opacity', 0.7)
      .style('pointer-events', 'none');

    g.append('text')
      .attr('x', endX + 4)
      .attr('y', yScale(lastRow.median_key))
      .attr('font-size', 11)
      .attr('fill', color)
      .attr('dominant-baseline', 'middle')
      .attr('opacity', emphasized ? 1 : 0.5)
      .style('pointer-events', 'none')
      .text(seasonAbbrev(season));
  }

  if (emphasizedSeasonId !== null) {
    const emphArc = arcs.find(a => a.season.id === emphasizedSeasonId);
    if (emphArc && emphArc.rows.length > 0) {
      const peak = emphArc.rows.reduce((best, r) =>
        r.median_key > best.median_key ? r : best,
      );
      const color = colors[emphArc.colorIndex % colors.length];
      g.append('text')
        .attr('x', xScale(peak.period_index))
        .attr('y', yScale(peak.median_key) - 14)
        .attr('text-anchor', 'middle')
        .attr('font-size', 11)
        .attr('font-weight', '700')
        .attr('fill', color)
        .style('pointer-events', 'none')
        .text(`▲ +${peak.median_key.toFixed(1)}`);
    }
  }
}

function drawTooltip(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  arcs: ArcEntry[],
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  width: number,
  height: number,
  emphasizedSeasonId: number | null,
  colors: readonly string[],
  container: HTMLElement,
): void {
  const activeArc =
    emphasizedSeasonId !== null
      ? (arcs.find(a => a.season.id === emphasizedSeasonId) ??
         arcs.reduce((best, a) => (a.rows.length > best.rows.length ? a : best)))
      : arcs.reduce((best, a) => (a.rows.length > best.rows.length ? a : best));

  if (!activeArc || activeArc.rows.length === 0) return;

  const color = colors[activeArc.colorIndex % colors.length];
  const seasonLabel = activeArc.season.name
    .replace('Mythic+ Dungeons (', '')
    .replace(')', '');
  const bisect = d3.bisector<WeeklyArcRow, number>(r => r.period_index).center;

  const tooltipEl = document.createElement('div');
  tooltipEl.style.cssText =
    'position:absolute;background:#1c1c1f;border:1px solid #52525b;border-radius:6px;' +
    'padding:10px 13px;font-size:12px;color:#e4e4e7;line-height:1.7;' +
    'box-shadow:0 4px 16px rgba(0,0,0,0.5);pointer-events:none;display:none;' +
    'font-family:sans-serif;white-space:nowrap';
  container.appendChild(tooltipEl);

  let lastHoveredId: number | null = null;

  function nearestArc(mx: number, my: number): ArcEntry {
    const week = xScale.invert(mx);
    let nearest = arcs[0];
    let minDist = Infinity;
    for (const arc of arcs) {
      if (arc.rows.length === 0) continue;
      const idx = bisect(arc.rows, week);
      const row = arc.rows[Math.max(0, Math.min(idx, arc.rows.length - 1))];
      const dist = Math.abs(yScale(row.median_key) - my);
      if (dist < minDist) { minDist = dist; nearest = arc; }
    }
    return nearest;
  }

  function updatePathStyles(hoveredSeasonId: number | null): void {
    g.selectAll<SVGPathElement, unknown>('path[data-season-id]').each(function () {
      const sid = Number(this.dataset.seasonId);
      const isEmphasized = emphasizedSeasonId === null || sid === emphasizedSeasonId;
      const isHovered = sid === hoveredSeasonId;
      let sw: number, op: number;
      if (emphasizedSeasonId === null) {
        sw = 2.5;
        op = isHovered || hoveredSeasonId === null ? 1.0 : 0.5;
      } else if (isEmphasized) {
        sw = 2.5; op = 1.0;
      } else if (isHovered) {
        sw = 2.0; op = 0.65;
      } else {
        sw = 1.5; op = 0.3;
      }
      d3.select(this).attr('stroke-width', sw).attr('opacity', op);
    });
  }

  g.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', 'none')
    .style('pointer-events', 'all')
    .style('cursor', 'pointer')
    .on('click', (event: MouseEvent) => {
      const [mx, my] = d3.pointer(event);
      setState({ selectedSeasonForArc: nearestArc(mx, my).season.id });
    })
    .on('mousemove', (event: MouseEvent) => {
      const [mx, my] = d3.pointer(event);
      const hovered = nearestArc(mx, my);
      if (hovered.season.id !== lastHoveredId) {
        lastHoveredId = hovered.season.id;
        updatePathStyles(lastHoveredId);
      }
      const idx = bisect(activeArc.rows, xScale.invert(mx));
      const row = activeArc.rows[Math.max(0, Math.min(idx, activeArc.rows.length - 1))];
      if (!row) return;

      const svgX = MARGIN.left + xScale(row.period_index);
      const cardW = 150;
      const left =
        svgX + cardW + 16 > container.clientWidth ? svgX - cardW - 12 : svgX + 12;

      const containerY = TITLE_H + MARGIN.top + my;
      const tooltipH = 90;
      const top = Math.max(TITLE_H + 4, containerY - tooltipH - 12);

      tooltipEl.style.display = 'block';
      tooltipEl.style.left = `${left}px`;
      tooltipEl.style.top = `${top}px`;

      const weekEl = document.createElement('div');
      weekEl.style.cssText =
        'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#71717a';
      weekEl.textContent = `Week ${row.period_index}`;

      const keyEl = document.createElement('div');
      keyEl.style.cssText = `font-size:16px;font-weight:700;color:${color}`;
      keyEl.textContent = `+${row.median_key.toFixed(1)}`;

      const nameEl = document.createElement('div');
      nameEl.style.cssText = 'font-size:11px;color:#a1a1aa;display:flex;align-items:center;gap:5px';
      const dot = document.createElement('span');
      dot.style.cssText =
        `width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0`;
      const label = document.createElement('span');
      label.textContent = seasonLabel;
      nameEl.appendChild(dot);
      nameEl.appendChild(label);

      tooltipEl.replaceChildren(weekEl, keyEl, nameEl);
    })
    .on('mouseleave', () => {
      tooltipEl.style.display = 'none';
      lastHoveredId = null;
      updatePathStyles(null);
    });
}

function seasonAbbrev(season: SeasonMeta): string {
  const m = season.name.match(/\((.+?) Season (\d+)\)/);
  if (!m) return `S${season.id}`;
  const expansions: Record<string, string> = {
    Shadowlands: 'SL',
    Dragonflight: 'DF',
    'The War Within': 'TWW',
  };
  return `${expansions[m[1]] ?? m[1]} S${m[2]}`;
}

