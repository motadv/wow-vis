import * as d3 from "d3";
import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import { getWeeklyArc, getSecondaryAffixImpact } from "../db/queries.js";
import { loadSeason, getAffixManifest } from "../db/init.js";
import { getState, setState, subscribe } from "../state.js";
import { dungeonColor } from "../utils/colors.js";
import { computeAverageArc } from "../utils/arc-utils.js";
import { MAX_SEASON } from "../config.js";
import type { DungeonManifest, SeasonMeta, WeeklyArcRow, DungeonMeta } from "../types.js";
import { FONT } from "../theme.js";
import { cellStyle } from "./affix-matrix.js";

type SecondaryAffixImpactMap = Map<number, number>; // affixId -> impactDelta

type ArcEntry = {
  season: SeasonMeta;
  rows: WeeklyArcRow[];
  colorIndex: number;
  secondaryAffixImpact: SecondaryAffixImpactMap;
};

const MARGIN = { top: 20, right: 60, bottom: 50, left: 44 };
const TYRANNICAL_AFFIX_ID = 9;
const FORTIFIED_AFFIX_ID = 10;

function getAffixColor(affixId: number, impactDelta?: number): string {
  if (affixId === FORTIFIED_AFFIX_ID) return "#3b82f6";
  if (affixId === TYRANNICAL_AFFIX_ID) return "#f97316";
  if (impactDelta !== undefined) {
    return cellStyle(impactDelta).text;
  }
  return "#a1a1aa";
}

let keyDomain: [number, number] = [0, 40];

export function setKeyDomain(min: number, max: number): void {
  keyDomain = [min, max];
}

export function initArc(
  container: HTMLElement,
  manifest: DungeonManifest,
  conn: AsyncDuckDBConnection,
): void {
  const emptyMsg = document.createElement("p");
  emptyMsg.style.cssText = `margin:0;padding:16px;font-size:${FONT.small}px;color:#71717a;text-align:center`;
  emptyMsg.textContent =
    "Select a dungeon on the map or heatmap to see its weekly progression.";
  container.appendChild(emptyMsg);

  let lastSelectionKey = '';
  let lastSingleData: ArcEntry[] = [];
  let lastMultiData = new Map<number, ArcEntry[]>();

  subscribe(async (state) => {
    if (state.selectedDungeons.length === 0) {
      lastSelectionKey = '';
      lastSingleData = [];
      container.replaceChildren(emptyMsg);
      return;
    }

    if (state.selectedDungeons.length > 1) {
      const selectionKey = [...state.selectedDungeons].sort().join(',');

      if (selectionKey !== lastSelectionKey) {
        const newMultiData = new Map<number, ArcEntry[]>();

        for (const dungeonId of state.selectedDungeons) {
          if (lastMultiData.has(dungeonId)) {
            newMultiData.set(dungeonId, lastMultiData.get(dungeonId)!);
            continue;
          }
          const activeSeasons = manifest.seasons
            .filter((s) => s.dungeonIds.includes(dungeonId) && s.id <= MAX_SEASON)
            .sort((a, b) => a.id - b.id);

          const entries = await Promise.all(
            activeSeasons.map(async (s, i) => {
              await loadSeason(s.id);
              const rows = await getWeeklyArc(conn, dungeonId, s.id);
              return {
                season: s,
                rows,
                colorIndex: i,
                secondaryAffixImpact: new Map<number, number>(),
              };
            }),
          );
          newMultiData.set(dungeonId, entries);
        }

        const currentKey = [...getState().selectedDungeons].sort().join(',');
        if (currentKey !== selectionKey) return;

        lastSelectionKey = selectionKey;
        lastMultiData = newMultiData;
        lastSingleData = [];
      }

      const selectedDungeons = state.selectedDungeons
        .map((id) => manifest.dungeons.find((d) => d.id === id))
        .filter((d): d is DungeonMeta => d !== undefined);

      renderMultiArc(container, selectedDungeons, lastMultiData);
      return;
    }

    // single mode
    const dungeonId = state.selectedDungeons[0];
    const selectionKey = String(dungeonId);

    if (selectionKey !== lastSelectionKey) {
      const activeSeasonsForDungeon = manifest.seasons
        .filter((s) => s.dungeonIds.includes(dungeonId) && s.id <= MAX_SEASON)
        .sort((a, b) => a.id - b.id);

      lastSingleData = await Promise.all(
        activeSeasonsForDungeon.map(async (s, i) => {
          await loadSeason(s.id);
          const [rows, affixImpacts] = await Promise.all([
            getWeeklyArc(conn, dungeonId, s.id),
            getSecondaryAffixImpact(conn, dungeonId, s.id),
          ]);
          const secondaryAffixImpact = new Map(
            affixImpacts.map((a) => [a.affixId, a.impactDelta]),
          );
          return { season: s, rows, colorIndex: i, secondaryAffixImpact };
        }),
      );

      if (getState().selectedDungeons[0] !== dungeonId) return;
      lastSelectionKey = selectionKey;
      lastMultiData.clear();
    }

    const dungeon = manifest.dungeons.find((d) => d.id === dungeonId);
    if (!dungeon) return;

    renderArc(container, dungeon.name, lastSingleData, state.selectedSeasonForArc);
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
  if (arcs.length === 0 || arcs.every((a) => a.rows.length === 0)) return;

  container.style.position = "relative";

  const titleEl = document.createElement("div");
  titleEl.style.cssText =
    "padding:14px 16px 0;display:flex;align-items:center;justify-content:space-between;";

  const titleText = document.createElement("span");
  titleText.style.cssText = `font-size:${FONT.large}px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#e4e4e7`;
  titleText.textContent = `${title} — Median Key Level per Week`;
  titleEl.appendChild(titleText);

  if (emphasizedSeasonId !== null) {
    const resetBtn = document.createElement("button");
    resetBtn.textContent = "View All";
    resetBtn.style.cssText = `
      padding:4px 10px;
      font-size:${FONT.small}px;
      border:1px solid #666;
      background:transparent;
      color:#999;
      border-radius:3px;
      cursor:pointer;
      transition:all 0.2s ease;
      font-weight:600;
    `;
    resetBtn.onmouseover = () => {
      resetBtn.style.borderColor = "#8b5cf6";
      resetBtn.style.color = "#c4b5fd";
    };
    resetBtn.onmouseout = () => {
      resetBtn.style.borderColor = "#666";
      resetBtn.style.color = "#999";
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
  const maxPeriods = Math.max(...arcs.map((a) => a.rows.length));

  const xScale = d3.scaleLinear().domain([1, maxPeriods]).range([0, width]);
  const yScale = d3.scaleLinear().domain(keyDomain).range([height, 0]);

  const line = d3
    .line<WeeklyArcRow>()
    .x((r) => xScale(r.period_index))
    .y((r) => yScale(r.median_key))
    .curve(d3.curveMonotoneX);

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", container.clientWidth)
    .attr("height", container.clientHeight - TITLE_H)
    .style("font-family", "sans-serif");

  const g = svg
    .append("g")
    .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

  drawAxes(g, xScale, yScale, height, width);
  drawLines(g, arcs, xScale, yScale, height, emphasizedSeasonId, colors, line);
  if (emphasizedSeasonId !== null) {
    drawMedianReference(g, arcs, yScale, width, emphasizedSeasonId);
  }
  drawTooltip(
    g,
    arcs,
    xScale,
    yScale,
    width,
    height,
    emphasizedSeasonId,
    colors,
    container,
  );
}

function renderMultiArc(
  container: HTMLElement,
  dungeons: DungeonMeta[],
  dungeonData: Map<number, ArcEntry[]>,
): void {
  container.replaceChildren();
  container.style.position = 'relative';

  const titleEl = document.createElement('div');
  titleEl.style.cssText =
    'padding:14px 16px 0;display:flex;align-items:center;justify-content:space-between;';
  const titleText = document.createElement('span');
  titleText.style.cssText = `font-size:${FONT.large}px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#e4e4e7`;
  titleText.textContent = `${dungeons.length} Dungeons — Median Key Level per Week`;
  titleEl.appendChild(titleText);
  container.appendChild(titleEl);

  const legendEl = document.createElement('div');
  legendEl.style.cssText = 'padding:6px 16px 4px;display:flex;gap:16px;flex-wrap:wrap;';
  for (let i = 0; i < dungeons.length; i++) {
    const color = dungeonColor(i);
    const item = document.createElement('div');
    item.style.cssText = 'display:flex;align-items:center;gap:5px;';
    const dot = document.createElement('span');
    dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;`;
    const label = document.createElement('span');
    label.style.cssText = `font-size:${FONT.small}px;color:#e4e4e7;`;
    label.textContent = dungeons[i].name;
    item.appendChild(dot);
    item.appendChild(label);
    legendEl.appendChild(item);
  }
  container.appendChild(legendEl);

  const allSeasonRows: ArcEntry[] = [];
  for (const entries of dungeonData.values()) allSeasonRows.push(...entries);
  if (allSeasonRows.length === 0 || allSeasonRows.every((e) => e.rows.length === 0)) return;

  const LEGEND_H = 32;
  const totalTitleH = TITLE_H + LEGEND_H;
  const width = container.clientWidth - MARGIN.left - MARGIN.right;
  const height = container.clientHeight - MARGIN.top - MARGIN.bottom - totalTitleH;
  const maxPeriods = Math.max(...allSeasonRows.map((e) => e.rows.length));

  const xScale = d3.scaleLinear().domain([1, maxPeriods]).range([0, width]);
  const yScale = d3.scaleLinear().domain(keyDomain).range([height, 0]);

  type ArcPoint = { period_index: number; median_key: number };
  const lineGen = d3
    .line<ArcPoint>()
    .x((r) => xScale(r.period_index))
    .y((r) => yScale(r.median_key))
    .curve(d3.curveMonotoneX);

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', container.clientWidth)
    .attr('height', container.clientHeight - totalTitleH)
    .style('font-family', 'sans-serif');

  const g = svg
    .append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  drawAxes(g, xScale, yScale, height, width);

  for (let i = 0; i < dungeons.length; i++) {
    const dungeon = dungeons[i];
    const color = dungeonColor(i);
    const entries = dungeonData.get(dungeon.id) ?? [];

    for (const { rows } of entries) {
      if (rows.length === 0) continue;
      g.append('path')
        .datum(rows as ArcPoint[])
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 1.2)
        .attr('opacity', 0.35)
        .attr('d', lineGen);
    }

    const avgRows = computeAverageArc(entries.map((e) => e.rows));
    if (avgRows.length === 0) continue;

    g.append('path')
      .datum(avgRows as ArcPoint[])
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 3)
      .attr('opacity', 1)
      .attr('d', lineGen);

    for (const pt of avgRows) {
      g.append('circle')
        .attr('cx', xScale(pt.period_index))
        .attr('cy', yScale(pt.median_key))
        .attr('r', 4)
        .attr('fill', color)
        .attr('opacity', 1)
        .style('pointer-events', 'none');
    }

    const last = avgRows[avgRows.length - 1];
    g.append('text')
      .attr('x', xScale(last.period_index) + 4)
      .attr('y', yScale(last.median_key))
      .attr('font-size', FONT.small)
      .attr('fill', color)
      .attr('dominant-baseline', 'middle')
      .style('pointer-events', 'none')
      .text(dungeon.abbrev);
  }
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
  yScale.ticks(5).forEach((tick) => {
    g.append("line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", yScale(tick))
      .attr("y2", yScale(tick))
      .attr("stroke", "#27272a")
      .attr("stroke-width", 1)
      .style("pointer-events", "none");
  });

  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(
      d3
        .axisBottom(xScale)
        .ticks(Math.min(maxPeriods, 10))
        .tickFormat((d) => `W${d}`),
    )
    .call((ax) => ax.select(".domain").attr("stroke", "#3f3f46"))
    .call((ax) =>
      ax
        .selectAll("text")
        .attr("fill", "#a1a1aa")
        .attr("font-size", FONT.small),
    )
    .call((ax) => ax.selectAll("line").attr("stroke", "#3f3f46"));

  g.append("g")
    .call(d3.axisLeft(yScale).ticks(5))
    .call((ax) => ax.select(".domain").attr("stroke", "#3f3f46"))
    .call((ax) =>
      ax
        .selectAll("text")
        .attr("fill", "#a1a1aa")
        .attr("font-size", FONT.small),
    )
    .call((ax) => ax.selectAll("line").attr("stroke", "#3f3f46"));

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -34)
    .attr("text-anchor", "middle")
    .attr("font-size", FONT.small)
    .attr("fill", "#71717a")
    .text("Median Key");

  g.append("text")
    .attr("x", width / 2)
    .attr("y", height + 38)
    .attr("text-anchor", "middle")
    .attr("font-size", FONT.small)
    .attr("fill", "#71717a")
    .text("Week of Season");
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
    const emphasized =
      emphasizedSeasonId === null || season.id === emphasizedSeasonId;
    const color = colors[colorIndex % colors.length];

    g.append("path")
      .datum(rows)
      .attr("data-season-id", String(season.id))
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", emphasized ? 2.5 : 1.5)
      .attr("opacity", emphasized ? 1 : 0.3)
      .attr("d", line);

    for (const row of rows) {
      g.append("circle")
        .attr("cx", xScale(row.period_index))
        .attr("cy", yScale(row.median_key))
        .attr("r", 3)
        .attr("fill", color)
        .attr("opacity", emphasized ? 1 : 0.3)
        .style("pointer-events", "none");
    }

    const lastRow = rows[rows.length - 1];
    const endX = xScale(lastRow.period_index);

    g.append("line")
      .attr("x1", endX)
      .attr("x2", endX)
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", color)
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4,3")
      .attr("opacity", 0.4)
      .style("pointer-events", "none");

    g.append("text")
      .attr("x", endX + 4)
      .attr("y", yScale(lastRow.median_key))
      .attr("font-size", FONT.small)
      .attr("fill", color)
      .attr("dominant-baseline", "middle")
      .attr("opacity", emphasized ? 1 : 0.5)
      .style("pointer-events", "none")
      .text(`S${season.id}`);
  }

  if (emphasizedSeasonId !== null) {
    const emphArc = arcs.find((a) => a.season.id === emphasizedSeasonId);
    if (emphArc && emphArc.rows.length > 0) {
      const peak = emphArc.rows.reduce((best, r) =>
        r.median_key > best.median_key ? r : best,
      );
      const color = colors[emphArc.colorIndex % colors.length];
      g.append("text")
        .attr("x", xScale(peak.period_index))
        .attr("y", yScale(peak.median_key) - 14)
        .attr("text-anchor", "middle")
        .attr("font-size", FONT.small)
        .attr("font-weight", "700")
        .attr("fill", color)
        .style("pointer-events", "none")
        .text(`▲ +${peak.median_key.toFixed(1)}`);
    }
  }
}

function drawMedianReference(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  arcs: ArcEntry[],
  yScale: d3.ScaleLinear<number, number>,
  width: number,
  emphasizedSeasonId: number,
): void {
  const emphArc = arcs.find((a) => a.season.id === emphasizedSeasonId);
  if (!emphArc || emphArc.rows.length === 0) return;

  const keys = emphArc.rows.map((r) => r.median_key).sort((a, b) => a - b);
  const medianKey =
    keys.length % 2 === 0
      ? (keys[keys.length / 2 - 1] + keys[keys.length / 2]) / 2
      : keys[Math.floor(keys.length / 2)];

  g.append("line")
    .attr("x1", 0)
    .attr("x2", width)
    .attr("y1", yScale(medianKey))
    .attr("y2", yScale(medianKey))
    .attr("stroke", "#71717a")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "4,3")
    .attr("opacity", 0.7)
    .style("pointer-events", "none");
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
      ? (arcs.find((a) => a.season.id === emphasizedSeasonId) ??
        arcs.reduce((best, a) => (a.rows.length > best.rows.length ? a : best)))
      : arcs.reduce((best, a) => (a.rows.length > best.rows.length ? a : best));

  if (!activeArc || activeArc.rows.length === 0) return;

  const color = colors[activeArc.colorIndex % colors.length];
  const seasonLabel = `S${activeArc.season.id}`;
  const bisect = d3.bisector<WeeklyArcRow, number>(
    (r) => r.period_index,
  ).center;

  const tooltipEl = document.createElement("div");
  tooltipEl.style.cssText =
    "position:absolute;background:#1c1c1f;border:1px solid #52525b;border-radius:6px;" +
    `padding:10px 13px;font-size:${FONT.small}px;color:#e4e4e7;line-height:1.7;` +
    "box-shadow:0 4px 16px rgba(0,0,0,0.5);pointer-events:none;display:none;" +
    "font-family:sans-serif;white-space:nowrap";
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
      if (dist < minDist) {
        minDist = dist;
        nearest = arc;
      }
    }
    return nearest;
  }

  function updatePathStyles(hoveredSeasonId: number | null): void {
    g.selectAll<SVGPathElement, unknown>("path[data-season-id]").each(
      function () {
        const sid = Number(this.dataset.seasonId);
        const isEmphasized =
          emphasizedSeasonId === null || sid === emphasizedSeasonId;
        const isHovered = sid === hoveredSeasonId;
        let sw: number, op: number;
        if (emphasizedSeasonId === null) {
          sw = 2.5;
          op = isHovered || hoveredSeasonId === null ? 1.0 : 0.5;
        } else if (isEmphasized) {
          sw = 2.5;
          op = 1.0;
        } else if (isHovered) {
          sw = 2.0;
          op = 0.65;
        } else {
          sw = 1.5;
          op = 0.3;
        }
        d3.select(this).attr("stroke-width", sw).attr("opacity", op);
      },
    );
  }

  g.append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "none")
    .style("pointer-events", "all")
    .style("cursor", "pointer")
    .on("click", (event: MouseEvent) => {
      const [mx, my] = d3.pointer(event);
      setState({ selectedSeasonForArc: nearestArc(mx, my).season.id });
    })
    .on("mousemove", (event: MouseEvent) => {
      const [mx, my] = d3.pointer(event);
      const hovered = nearestArc(mx, my);
      if (hovered.season.id !== lastHoveredId) {
        lastHoveredId = hovered.season.id;
        updatePathStyles(lastHoveredId);
      }
      const idx = bisect(activeArc.rows, xScale.invert(mx));
      const row =
        activeArc.rows[Math.max(0, Math.min(idx, activeArc.rows.length - 1))];
      if (!row) return;

      const svgX = MARGIN.left + xScale(row.period_index);
      const cardW = 180;
      const left =
        svgX + cardW + 16 > container.clientWidth
          ? svgX - cardW - 12
          : svgX + 12;

      const containerY = TITLE_H + MARGIN.top + my;
      const tooltipH = 120;
      const top = Math.max(TITLE_H + 4, containerY - tooltipH - 12);

      tooltipEl.style.display = "block";
      tooltipEl.style.left = `${left}px`;
      tooltipEl.style.top = `${top}px`;

      const weekEl = document.createElement("div");
      weekEl.style.cssText = `font-size:${FONT.small}px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#71717a`;
      weekEl.textContent = `Week ${row.period_index}`;

      // Calculate season median for color coding
      const seasonKeys = activeArc.rows
        .map((r) => r.median_key)
        .sort((a, b) => a - b);
      const seasonMedian =
        seasonKeys.length % 2 === 0
          ? (seasonKeys[seasonKeys.length / 2 - 1] +
              seasonKeys[seasonKeys.length / 2]) /
            2
          : seasonKeys[Math.floor(seasonKeys.length / 2)];
      const delta = row.median_key - seasonMedian;
      const keyColor = cellStyle(delta).text;

      const keyEl = document.createElement("div");
      keyEl.style.cssText = `font-size:${FONT.large}px;font-weight:700;display:flex;align-items:baseline;gap:6px`;

      const keySpan = document.createElement("span");
      keySpan.style.cssText = `color:${keyColor}`;
      keySpan.textContent = `+${row.median_key.toFixed(1)}`;
      keyEl.appendChild(keySpan);

      const medianSpan = document.createElement("span");
      medianSpan.style.cssText = `font-size:${FONT.small}px;color:#71717a;font-weight:400`;
      medianSpan.textContent = `(${seasonMedian.toFixed(1)})`;
      keyEl.appendChild(medianSpan);

      const nameEl = document.createElement("div");
      nameEl.style.cssText = `font-size:${FONT.small}px;color:#a1a1aa;display:flex;align-items:center;gap:5px`;
      const dot = document.createElement("span");
      dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0`;
      const label = document.createElement("span");
      label.textContent = seasonLabel;
      nameEl.appendChild(dot);
      nameEl.appendChild(label);

      const affixManifest = getAffixManifest();
      const affixEntries =
        affixManifest[activeArc.season.id]?.[row.period] ?? [];

      const affixEl = document.createElement("div");
      affixEl.style.cssText = `font-size:${FONT.small}px;margin-top:3px;display:flex;flex-wrap:wrap;gap:6px;align-items:center`;

      if (affixEntries.length > 0) {
        for (const affix of affixEntries) {
          const affixSpan = document.createElement("span");
          const impactDelta = activeArc.secondaryAffixImpact.get(affix.id);
          const color = getAffixColor(affix.id, impactDelta);
          affixSpan.style.cssText = `color:${color};font-weight:500`;
          affixSpan.textContent = affix.name;
          affixEl.appendChild(affixSpan);
        }
      } else {
        affixEl.textContent = "—";
        affixEl.style.color = "#71717a";
      }

      tooltipEl.replaceChildren(weekEl, keyEl, nameEl, affixEl);
    })
    .on("mouseleave", () => {
      tooltipEl.style.display = "none";
      lastHoveredId = null;
      updatePathStyles(null);
    });
}
