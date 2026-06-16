import * as d3 from "d3";
import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import { getWeeklyArc, getSecondaryAffixImpact } from "../db/queries.js";
import { loadSeason, getAffixManifest } from "../db/init.js";
import { getState, setState, subscribe } from "../state.js";
import { dungeonColor } from "../utils/colors.js";
import { computeAverageArc, collectAtWeek, computeSharedSeasons, computeWeekLeaders } from "../utils/arc-utils.js";
import { MAX_SEASON, DISABLED_SEASONS } from "../config.js";
import type {
  DungeonManifest,
  SeasonMeta,
  WeeklyArcRow,
  DungeonMeta,
} from "../types.js";
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
const TOOLTIP_OFFSET = 100;
const TYRANNICAL_AFFIX_ID = 9;
const FORTIFIED_AFFIX_ID = 10;

function getAffixColor(affixId: number, impactDelta?: number): string {
  if (affixId === FORTIFIED_AFFIX_ID) return "#3b82f6";
  if (affixId === TYRANNICAL_AFFIX_ID) return "#f97316";
  if (impactDelta !== undefined) {
    return cellStyle(impactDelta).bg;
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

  let lastSelectionKey = "";
  let lastSingleData: ArcEntry[] = [];
  let lastMultiData = new Map<number, ArcEntry[]>();
  let comparisonSeasonId: number | null = null;
  const affixImpactCache = new Map<string, Map<number, { affixName: string; impactDelta: number }>>();

  const onSelectSeason = async (seasonId: number | null): Promise<void> => {
    comparisonSeasonId = seasonId;

    if (seasonId !== null) {
      const dungeonIds = getState().selectedDungeons;
      await Promise.all(
        dungeonIds.map(async (dungeonId) => {
          const cacheKey = `${dungeonId}:${seasonId}`;
          if (!affixImpactCache.has(cacheKey)) {
            const impacts = await getSecondaryAffixImpact(conn, dungeonId, seasonId);
            affixImpactCache.set(
              cacheKey,
              new Map(impacts.map(i => [i.affixId, { affixName: i.affixName, impactDelta: i.impactDelta }])),
            );
          }
        }),
      );
    }

    const currentState = getState();
    const selectedDungeons = currentState.selectedDungeons
      .map(id => manifest.dungeons.find(d => d.id === id))
      .filter((d): d is DungeonMeta => d !== undefined);
    const sharedSeasons = computeSharedSeasons(
      manifest.seasons,
      currentState.selectedDungeons,
      DISABLED_SEASONS,
      MAX_SEASON,
    );
    renderMultiArc(container, selectedDungeons, lastMultiData, sharedSeasons, comparisonSeasonId, onSelectSeason, affixImpactCache);
  };

  subscribe(async (state) => {
    if (state.selectedDungeons.length === 0) {
      lastSelectionKey = "";
      lastSingleData = [];
      container.replaceChildren(emptyMsg);
      return;
    }

    if (state.selectedDungeons.length > 1) {
      const selectionKey = [...state.selectedDungeons].sort().join(",");

      if (selectionKey !== lastSelectionKey) {
        comparisonSeasonId = null;
        const newMultiData = new Map<number, ArcEntry[]>();

        for (const dungeonId of state.selectedDungeons) {
          if (lastMultiData.has(dungeonId)) {
            newMultiData.set(dungeonId, lastMultiData.get(dungeonId)!);
            continue;
          }
          const activeSeasons = manifest.seasons
            .filter(
              (s) => s.dungeonIds.includes(dungeonId) && s.id <= MAX_SEASON && !DISABLED_SEASONS.has(s.id),
            )
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

        const currentKey = [...getState().selectedDungeons].sort().join(",");
        if (currentKey !== selectionKey) return;

        lastSelectionKey = selectionKey;
        lastMultiData = newMultiData;
        lastSingleData = [];
      }

      const selectedDungeons = state.selectedDungeons
        .map((id) => manifest.dungeons.find((d) => d.id === id))
        .filter((d): d is DungeonMeta => d !== undefined);

      const sharedSeasons = computeSharedSeasons(
        manifest.seasons,
        state.selectedDungeons,
        DISABLED_SEASONS,
        MAX_SEASON,
      );
      renderMultiArc(container, selectedDungeons, lastMultiData, sharedSeasons, comparisonSeasonId, onSelectSeason, affixImpactCache);
      return;
    }

    // single mode
    const dungeonId = state.selectedDungeons[0];
    const selectionKey = String(dungeonId);

    if (selectionKey !== lastSelectionKey) {
      const activeSeasonsForDungeon = manifest.seasons
        .filter((s) => s.dungeonIds.includes(dungeonId) && s.id <= MAX_SEASON && !DISABLED_SEASONS.has(s.id))
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

    renderArc(
      container,
      dungeon.name,
      lastSingleData,
      state.selectedSeasonForArc,
    );
  });
}

const TITLE_H = 48;
const CHIP_H = 36;

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

  container.appendChild(titleEl);

  const colors = d3.schemeTableau10 as readonly string[];
  const width = container.clientWidth - MARGIN.left - MARGIN.right;
  const height = container.clientHeight - MARGIN.top - MARGIN.bottom - TITLE_H;
  const maxPeriods = Math.max(...arcs.flatMap((a) => a.rows.map((r) => r.period_index)));

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

function drawComparisonTooltip(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  dungeons: DungeonMeta[],
  rowsByDungeon: Map<number, WeeklyArcRow[]>,
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  width: number,
  height: number,
  totalTitleH: number,
  container: HTMLElement,
  seasonId: number,
  affixImpactCache: Map<string, Map<number, { affixName: string; impactDelta: number }>>,
): void {
  const tooltipEl = document.createElement("div");
  tooltipEl.style.cssText =
    "position:absolute;background:#1c1c1f;border:1px solid #52525b;border-radius:6px;" +
    `padding:10px 13px;font-size:${FONT.small}px;color:#e4e4e7;line-height:1.7;` +
    "box-shadow:0 4px 16px rgba(0,0,0,0.5);pointer-events:none;display:none;" +
    "font-family:sans-serif;white-space:nowrap";
  container.appendChild(tooltipEl);

  const maxPeriods = Math.round(xScale.domain()[1]);
  const affixManifest = getAffixManifest();

  const hoverCircles = dungeons.map((_, i) =>
    g
      .append("circle")
      .attr("r", 0)
      .attr("fill", dungeonColor(i))
      .attr("stroke", "white")
      .attr("stroke-width", 1.5)
      .attr("opacity", 0.9)
      .style("pointer-events", "none"),
  );

  g.append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "none")
    .style("pointer-events", "all")
    .on("mousemove", (event: MouseEvent) => {
      const [mx, my] = d3.pointer(event);
      const periodIndex = Math.max(1, Math.min(Math.round(xScale.invert(mx)), maxPeriods));

      const dataPoints = dungeons
        .map((dungeon, i) => {
          const rows = rowsByDungeon.get(dungeon.id) ?? [];
          const row = rows.find(r => r.period_index === periodIndex);
          return row
            ? { dungeon, color: dungeonColor(i), key: row.median_key, period: row.period, i }
            : null;
        })
        .filter((d): d is NonNullable<typeof d> => d !== null)
        .sort((a, b) => b.key - a.key);

      hoverCircles.forEach((circle, i) => {
        const rows = rowsByDungeon.get(dungeons[i].id) ?? [];
        const row = rows.find(r => r.period_index === periodIndex);
        if (row) {
          circle.attr("cx", xScale(row.period_index)).attr("cy", yScale(row.median_key)).attr("r", 6);
        } else {
          circle.attr("r", 0);
        }
      });

      if (dataPoints.length === 0) {
        tooltipEl.style.display = "none";
        return;
      }

      const svgX = MARGIN.left + xScale(periodIndex);
      const cardW = 260;
      const left =
        svgX + cardW + TOOLTIP_OFFSET > container.clientWidth
          ? svgX - cardW - TOOLTIP_OFFSET
          : svgX + TOOLTIP_OFFSET;
      const containerY = totalTitleH + MARGIN.top + my;
      const top = Math.max(totalTitleH + 4, containerY - 60);

      tooltipEl.style.display = "block";
      tooltipEl.style.left = `${left}px`;
      tooltipEl.style.top = `${top}px`;

      const children: HTMLElement[] = [];

      const weekEl = document.createElement("div");
      weekEl.style.cssText = `font-size:${FONT.small}px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#71717a;margin-bottom:6px`;
      weekEl.textContent = `Week ${periodIndex}`;
      children.push(weekEl);

      const leader = dataPoints[0].key;
      const grid = document.createElement("div");
      grid.style.cssText =
        "display:grid;grid-template-columns:10px 1fr 54px;align-items:center;row-gap:3px;column-gap:6px;margin-bottom:8px";

      for (const { dungeon, color, key } of dataPoints) {
        const dot = document.createElement("span");
        dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;justify-self:center`;

        const nameEl = document.createElement("span");
        nameEl.style.cssText = `font-size:${FONT.small}px;color:#a1a1aa;overflow:hidden;text-overflow:ellipsis;white-space:nowrap`;
        nameEl.textContent = dungeon.name;

        const keyEl = document.createElement("span");
        keyEl.style.cssText = `font-size:${FONT.small}px;font-weight:700;color:${key === leader ? "#e4e4e7" : "#71717a"};text-align:right`;
        keyEl.textContent = `+${key.toFixed(2)}`;

        grid.appendChild(dot);
        grid.appendChild(nameEl);
        grid.appendChild(keyEl);
      }
      children.push(grid);

      const rawPeriod = dataPoints[0].period;
      const weekAffixes = affixManifest[seasonId]?.[rawPeriod] ?? [];

      if (weekAffixes.length > 0) {
        const affixHeader = document.createElement("div");
        affixHeader.style.cssText = `font-size:${FONT.small}px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#71717a;margin-bottom:4px`;
        affixHeader.textContent = "Affixes";
        children.push(affixHeader);

        for (const affix of weekAffixes) {
          const isPrimary = affix.id === FORTIFIED_AFFIX_ID || affix.id === TYRANNICAL_AFFIX_ID;
          const affixBadgeColor = getAffixColor(affix.id);

          const affixRow = document.createElement("div");
          affixRow.style.cssText =
            "display:flex;align-items:baseline;gap:8px;margin-bottom:3px;flex-wrap:wrap;";

          const badgeEl = document.createElement("span");
          badgeEl.style.cssText = `font-size:${FONT.small}px;font-weight:600;color:${affixBadgeColor};flex-shrink:0;`;
          badgeEl.textContent = affix.name;
          affixRow.appendChild(badgeEl);

          if (!isPrimary) {
            for (let i = 0; i < dungeons.length; i++) {
              const dungeon = dungeons[i];
              const cacheKey = `${dungeon.id}:${seasonId}`;
              const impact = affixImpactCache.get(cacheKey)?.get(affix.id);
              if (impact === undefined) continue;

              const color = dungeonColor(i);
              const deltaStyle = cellStyle(impact.impactDelta);
              const sign = impact.impactDelta >= 0 ? "+" : "";

              const deltaEl = document.createElement("span");
              deltaEl.style.cssText = `font-size:${FONT.small}px;`;

              const abbrevSpan = document.createElement("span");
              abbrevSpan.style.color = color;
              abbrevSpan.textContent = dungeon.abbrev;

              const valueSpan = document.createElement("span");
              valueSpan.style.color = deltaStyle.bg;
              valueSpan.textContent = ` ${sign}${impact.impactDelta.toFixed(2)}`;

              deltaEl.appendChild(abbrevSpan);
              deltaEl.appendChild(valueSpan);
              affixRow.appendChild(deltaEl);
            }
          }

          children.push(affixRow);
        }
      }

      tooltipEl.replaceChildren(...children);
    })
    .on("mouseleave", () => {
      tooltipEl.style.display = "none";
      hoverCircles.forEach(c => c.attr("r", 0));
    });
}

function drawLeaderRibbon(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  dungeons: DungeonMeta[],
  rowsByDungeon: Map<number, WeeklyArcRow[]>,
  xScale: d3.ScaleLinear<number, number>,
  yOffset: number,
  ribbonHeight: number,
): void {
  const leaders = computeWeekLeaders(
    dungeons,
    rowsByDungeon as Map<number, ReadonlyArray<{ period_index: number; median_key: number }>>,
  );
  if (leaders.size === 0) return;

  const domain = xScale.domain();
  const maxPeriods = Math.round(domain[1]);
  const halfStep = maxPeriods > 1 ? (xScale(2) - xScale(1)) / 2 : xScale(1) / 2;

  const ribbonG = g.append("g").attr("transform", `translate(0,${yOffset})`);

  for (const [period, leaderId] of leaders.entries()) {
    const dungeonIdx = dungeons.findIndex(d => d.id === leaderId);
    const color = dungeonIdx >= 0 ? dungeonColor(dungeonIdx) : "#3f3f46";
    ribbonG
      .append("rect")
      .attr("x", xScale(period) - halfStep)
      .attr("y", 0)
      .attr("width", halfStep * 2)
      .attr("height", ribbonHeight)
      .attr("fill", color)
      .attr("opacity", 0.85)
      .style("pointer-events", "none");
  }
}

function renderComparisonView(
  container: HTMLElement,
  dungeons: DungeonMeta[],
  dungeonData: Map<number, ArcEntry[]>,
  comparisonSeasonId: number,
  affixImpactCache: Map<string, Map<number, { affixName: string; impactDelta: number }>>,
): void {
  const rowsByDungeon = new Map<number, WeeklyArcRow[]>();
  for (const dungeon of dungeons) {
    const entry = (dungeonData.get(dungeon.id) ?? []).find(
      e => e.season.id === comparisonSeasonId,
    );
    if (entry && entry.rows.length > 0) rowsByDungeon.set(dungeon.id, entry.rows);
  }
  if (rowsByDungeon.size === 0) return;

  const allRows = Array.from(rowsByDungeon.values()).flat();
  const maxPeriods = Math.max(...allRows.map(r => r.period_index));
  const RIBBON_H = 8;

  const width = container.clientWidth - MARGIN.left - MARGIN.right;
  const height = container.clientHeight - MARGIN.top - MARGIN.bottom - TITLE_H - CHIP_H;
  const chartHeight = height - RIBBON_H;

  const xScale = d3.scaleLinear().domain([1, maxPeriods]).range([0, width]);
  const yScale = d3.scaleLinear().domain(keyDomain).range([chartHeight, 0]);

  const lineGen = d3
    .line<WeeklyArcRow>()
    .x(r => xScale(r.period_index))
    .y(r => yScale(r.median_key))
    .curve(d3.curveMonotoneX);

  const svgHeight = container.clientHeight - TITLE_H - CHIP_H;
  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", container.clientWidth)
    .attr("height", svgHeight)
    .style("font-family", "sans-serif");

  const g = svg
    .append("g")
    .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

  drawAxes(g, xScale, yScale, chartHeight, width);

  for (let i = 0; i < dungeons.length; i++) {
    const dungeon = dungeons[i];
    const rows = rowsByDungeon.get(dungeon.id);
    if (!rows) continue;
    const color = dungeonColor(i);

    g.append("path")
      .datum(rows)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", 2.5)
      .attr("opacity", 1)
      .attr("d", lineGen);

    for (const row of rows) {
      g.append("circle")
        .attr("cx", xScale(row.period_index))
        .attr("cy", yScale(row.median_key))
        .attr("r", 3)
        .attr("fill", color)
        .style("pointer-events", "none");
    }
  }

  drawLeaderRibbon(g, dungeons, rowsByDungeon, xScale, chartHeight, RIBBON_H);
  drawComparisonTooltip(
    g,
    dungeons,
    rowsByDungeon,
    xScale,
    yScale,
    width,
    chartHeight,
    TITLE_H + CHIP_H,
    container,
    comparisonSeasonId,
    affixImpactCache,
  );
}

function renderSeasonChips(
  container: HTMLElement,
  sharedSeasons: SeasonMeta[],
  activeSeasonId: number | null,
  onSelect: (id: number | null) => void | Promise<void>,
): void {
  const row = document.createElement("div");
  row.style.cssText =
    "padding:4px 16px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center;";

  const label = document.createElement("span");
  label.style.cssText = `font-size:${FONT.small}px;color:#52525b;`;
  label.textContent = "Compare in:";
  row.appendChild(label);

  for (const season of sharedSeasons) {
    const isActive = season.id === activeSeasonId;
    const chip = document.createElement("button");
    chip.style.cssText = [
      `font-size:${FONT.small}px`,
      "font-family:sans-serif",
      "cursor:pointer",
      "border-radius:4px",
      "padding:2px 8px",
      isActive
        ? "background:#3f3f46;border:1px solid #a1a1aa;color:#e4e4e7"
        : "background:transparent;border:1px solid #3f3f46;color:#71717a",
    ].join(";");
    chip.textContent = `S${season.id}`;
    chip.addEventListener("click", () => { void onSelect(isActive ? null : season.id); });
    row.appendChild(chip);
  }
  container.appendChild(row);
}

function renderMultiArc(
  container: HTMLElement,
  dungeons: DungeonMeta[],
  dungeonData: Map<number, ArcEntry[]>,
  sharedSeasons: SeasonMeta[],
  comparisonSeasonId: number | null,
  onSelectSeason: (id: number | null) => void | Promise<void>,
  affixImpactCache: Map<string, Map<number, { affixName: string; impactDelta: number }>>,
): void {
  container.replaceChildren();
  container.style.position = "relative";

  const titleEl = document.createElement("div");
  titleEl.style.cssText =
    "padding:14px 16px 0;display:flex;align-items:center;justify-content:space-between;";
  const titleText = document.createElement("span");
  titleText.style.cssText = `font-size:${FONT.large}px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#e4e4e7`;
  titleText.textContent = `${dungeons.length} Dungeons — Median Key Level per Week`;
  titleEl.appendChild(titleText);
  container.appendChild(titleEl);

  const legendEl = document.createElement("div");
  legendEl.style.cssText =
    "padding:6px 16px 4px;display:flex;gap:16px;flex-wrap:wrap;";
  for (let i = 0; i < dungeons.length; i++) {
    const color = dungeonColor(i);
    const item = document.createElement("div");
    item.style.cssText = "display:flex;align-items:center;gap:5px;";
    const dot = document.createElement("span");
    dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;`;
    const label = document.createElement("span");
    label.style.cssText = `font-size:${FONT.small}px;color:#e4e4e7;`;
    label.textContent = dungeons[i].name;
    item.appendChild(dot);
    item.appendChild(label);
    legendEl.appendChild(item);
  }
  container.appendChild(legendEl);

  if (sharedSeasons.length > 0) {
    renderSeasonChips(container, sharedSeasons, comparisonSeasonId, onSelectSeason);
  }

  if (comparisonSeasonId !== null) {
    renderComparisonView(container, dungeons, dungeonData, comparisonSeasonId, affixImpactCache);
    return;
  }

  const allSeasonRows: ArcEntry[] = [];
  for (const entries of dungeonData.values()) allSeasonRows.push(...entries);
  if (
    allSeasonRows.length === 0 ||
    allSeasonRows.every((e) => e.rows.length === 0)
  )
    return;

  const LEGEND_H = 32;
  const chipOffset = sharedSeasons.length > 0 ? CHIP_H : 0;
  const totalTitleH = TITLE_H + LEGEND_H;
  const width = container.clientWidth - MARGIN.left - MARGIN.right;
  const height =
    container.clientHeight - MARGIN.top - MARGIN.bottom - totalTitleH - chipOffset;
  const maxPeriods = Math.max(...allSeasonRows.flatMap((e) => e.rows.map((r) => r.period_index)));

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
    .append("svg")
    .attr("width", container.clientWidth)
    .attr("height", container.clientHeight - totalTitleH - chipOffset)
    .style("font-family", "sans-serif");

  const g = svg
    .append("g")
    .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

  drawAxes(g, xScale, yScale, height, width);

  const avgRowsMap = new Map<number, ArcPoint[]>();

  for (let i = 0; i < dungeons.length; i++) {
    const dungeon = dungeons[i];
    const color = dungeonColor(i);
    const entries = dungeonData.get(dungeon.id) ?? [];

    for (const { rows } of entries) {
      if (rows.length === 0) continue;
      g.append("path")
        .datum(rows as ArcPoint[])
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 1.2)
        .attr("opacity", 0.35)
        .attr("d", lineGen);
    }

    const avgRows = computeAverageArc(entries.map((e) => e.rows));
    avgRowsMap.set(dungeon.id, avgRows);
    if (avgRows.length === 0) continue;

    g.append("path")
      .datum(avgRows as ArcPoint[])
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", 3)
      .attr("opacity", 1)
      .attr("d", lineGen);

    for (const pt of avgRows) {
      g.append("circle")
        .attr("cx", xScale(pt.period_index))
        .attr("cy", yScale(pt.median_key))
        .attr("r", 4)
        .attr("fill", color)
        .attr("opacity", 1)
        .style("pointer-events", "none");
    }

    const last = avgRows[avgRows.length - 1];
    g.append("text")
      .attr("x", xScale(last.period_index) + 4)
      .attr("y", yScale(last.median_key))
      .attr("font-size", FONT.small)
      .attr("fill", color)
      .attr("dominant-baseline", "middle")
      .style("pointer-events", "none")
      .text(dungeon.abbrev);
  }

  drawMultiDungeonTooltip(
    g,
    dungeons,
    avgRowsMap,
    xScale,
    yScale,
    width,
    height,
    totalTitleH + chipOffset,
    container,
  );
}

function drawMultiDungeonTooltip(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  dungeons: DungeonMeta[],
  avgRowsMap: Map<number, { period_index: number; median_key: number }[]>,
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  width: number,
  height: number,
  totalTitleH: number,
  container: HTMLElement,
): void {
  const tooltipEl = document.createElement("div");
  tooltipEl.style.cssText =
    "position:absolute;background:#1c1c1f;border:1px solid #52525b;border-radius:6px;" +
    `padding:10px 13px;font-size:${FONT.small}px;color:#e4e4e7;line-height:1.7;` +
    "box-shadow:0 4px 16px rgba(0,0,0,0.5);pointer-events:none;display:none;" +
    "font-family:sans-serif;white-space:nowrap";
  container.appendChild(tooltipEl);

  const hoverCircles = dungeons.map((_, i) =>
    g
      .append("circle")
      .attr("r", 0)
      .attr("fill", dungeonColor(i))
      .attr("stroke", "white")
      .attr("stroke-width", 1.5)
      .attr("opacity", 0.9)
      .style("pointer-events", "none"),
  );

  const maxPeriods = Math.round(xScale.domain()[1]);

  g.append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "none")
    .style("pointer-events", "all")
    .on("mousemove", (event: MouseEvent) => {
      const [mx, my] = d3.pointer(event);
      const periodIndex = Math.max(
        1,
        Math.min(Math.round(xScale.invert(mx)), maxPeriods),
      );

      const dataPoints = dungeons
        .map((dungeon, i) => {
          const rows = avgRowsMap.get(dungeon.id) ?? [];
          const row = rows.find((r) => r.period_index === periodIndex);
          return row ? { dungeon, color: dungeonColor(i), key: row.median_key, i } : null;
        })
        .filter((d): d is NonNullable<typeof d> => d !== null)
        .sort((a, b) => b.key - a.key);

      hoverCircles.forEach((circle, i) => {
        const rows = avgRowsMap.get(dungeons[i].id) ?? [];
        const row = rows.find((r) => r.period_index === periodIndex);
        if (row) {
          circle
            .attr("cx", xScale(row.period_index))
            .attr("cy", yScale(row.median_key))
            .attr("r", 6);
        } else {
          circle.attr("r", 0);
        }
      });

      if (dataPoints.length === 0) {
        tooltipEl.style.display = "none";
        return;
      }

      const svgX = MARGIN.left + xScale(periodIndex);
      const cardW = 200;
      const left =
        svgX + cardW + TOOLTIP_OFFSET > container.clientWidth
          ? svgX - cardW - TOOLTIP_OFFSET
          : svgX + TOOLTIP_OFFSET;
      const containerY = totalTitleH + MARGIN.top + my;
      const top = Math.max(totalTitleH + 4, containerY - 60);

      tooltipEl.style.display = "block";
      tooltipEl.style.left = `${left}px`;
      tooltipEl.style.top = `${top}px`;

      const weekEl = document.createElement("div");
      weekEl.style.cssText = `font-size:${FONT.small}px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#71717a;margin-bottom:6px`;
      weekEl.textContent = `Week ${periodIndex}`;

      const leader = dataPoints[0].key;
      const children: HTMLElement[] = [weekEl];

      const grid = document.createElement("div");
      grid.style.cssText =
        "display:grid;grid-template-columns:10px 1fr 54px 46px;align-items:center;row-gap:3px;column-gap:6px;";

      for (const { dungeon, color, key } of dataPoints) {
        const dot = document.createElement("span");
        dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;justify-self:center`;

        const nameEl = document.createElement("span");
        nameEl.style.cssText = `font-size:${FONT.small}px;color:#a1a1aa;overflow:hidden;text-overflow:ellipsis;white-space:nowrap`;
        nameEl.textContent = dungeon.name;

        const keyEl = document.createElement("span");
        keyEl.style.cssText = `font-size:${FONT.small}px;font-weight:700;color:#e4e4e7;text-align:right`;
        keyEl.textContent = `+${key.toFixed(2)}`;

        const diffEl = document.createElement("span");
        diffEl.style.cssText = `font-size:${FONT.small}px;color:#71717a;text-align:right`;
        const diff = key - leader;
        diffEl.textContent = diff < 0 ? diff.toFixed(2) : "";

        grid.appendChild(dot);
        grid.appendChild(nameEl);
        grid.appendChild(keyEl);
        grid.appendChild(diffEl);
      }

      children.push(grid);
      tooltipEl.replaceChildren(...children);
    })
    .on("mouseleave", () => {
      tooltipEl.style.display = "none";
      hoverCircles.forEach((c) => c.attr("r", 0));
    });
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
        .attr("data-period", row.period_index)
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

  const hoverCircles = arcs.map(() =>
    g
      .append("circle")
      .attr("r", 0)
      .attr("fill", "white")
      .attr("opacity", 0.9)
      .style("pointer-events", "none"),
  );

  g.append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "none")
    .style("pointer-events", "all")
    .style("cursor", "pointer")
    .on("click", (event: MouseEvent) => {
      const [mx, my] = d3.pointer(event);
      const clicked = nearestArc(mx, my).season.id;
      setState({
        selectedSeasonForArc: clicked === emphasizedSeasonId ? null : clicked,
      });
    })
    .on("mousemove", (event: MouseEvent) => {
      const [mx, my] = d3.pointer(event);
      const hovered = nearestArc(mx, my);
      if (hovered.season.id !== lastHoveredId) {
        lastHoveredId = hovered.season.id;
        updatePathStyles(lastHoveredId);
      }

      if (emphasizedSeasonId === null) {
        // Multi-arc mode: combined tooltip for all seasons at the hovered week
        const maxPeriods = Math.round(xScale.domain()[1]);
        const periodIndex = Math.max(
          1,
          Math.min(Math.round(xScale.invert(mx)), maxPeriods),
        );
        const dataPoints = collectAtWeek(arcs, periodIndex);

        hoverCircles.forEach((circle, i) => {
          const row = arcs[i].rows.find((r) => r.period_index === periodIndex);
          if (row) {
            circle
              .attr("cx", xScale(row.period_index))
              .attr("cy", yScale(row.median_key))
              .attr("r", 5);
          } else {
            circle.attr("r", 0);
          }
        });

        if (dataPoints.length === 0) {
          tooltipEl.style.display = "none";
          return;
        }

        const svgX = MARGIN.left + xScale(periodIndex);
        const cardW = 220;
        const left =
          svgX + cardW + TOOLTIP_OFFSET > container.clientWidth
            ? svgX - cardW - TOOLTIP_OFFSET
            : svgX + TOOLTIP_OFFSET;
        const containerY = TITLE_H + MARGIN.top + my;
        const top = Math.max(TITLE_H + 4, containerY - 60);

        tooltipEl.style.display = "block";
        tooltipEl.style.left = `${left}px`;
        tooltipEl.style.top = `${top}px`;

        const weekEl = document.createElement("div");
        weekEl.style.cssText = `font-size:${FONT.small}px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#71717a;margin-bottom:6px`;
        weekEl.textContent = `Week ${periodIndex}`;

        const children: HTMLElement[] = [weekEl];
        const affixManifest = getAffixManifest();

        for (let i = 0; i < dataPoints.length; i++) {
          if (i > 0) {
            const sep = document.createElement("div");
            sep.style.cssText = "border-top:1px solid #3f3f46;margin:6px 0";
            children.push(sep);
          }

          const { arc, row } = dataPoints[i];
          const arcColor = colors[arc.colorIndex % colors.length];
          const affixEntries = affixManifest[arc.season.id]?.[row.period] ?? [];

          const seasonEl = document.createElement("div");
          seasonEl.style.cssText =
            "display:flex;align-items:center;gap:5px;margin-bottom:2px";
          const dot = document.createElement("span");
          dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${arcColor};display:inline-block;flex-shrink:0`;
          const seasonLabelEl = document.createElement("span");
          seasonLabelEl.style.cssText = `font-size:${FONT.small}px;color:#a1a1aa;flex:1`;
          seasonLabelEl.textContent = `S${arc.season.id}`;
          const keySpan = document.createElement("span");
          keySpan.style.cssText = `font-size:${FONT.small}px;font-weight:700;color:#e4e4e7`;
          keySpan.textContent = `+${row.median_key.toFixed(1)}`;
          seasonEl.appendChild(dot);
          seasonEl.appendChild(seasonLabelEl);
          seasonEl.appendChild(keySpan);

          const affixEl = document.createElement("div");
          affixEl.style.cssText = `font-size:${FONT.small}px;display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-left:13px`;
          if (affixEntries.length > 0) {
            for (const affix of affixEntries) {
              const affixSpan = document.createElement("span");
              const impactDelta = arc.secondaryAffixImpact.get(affix.id);
              affixSpan.style.cssText = `color:${getAffixColor(affix.id, impactDelta)};font-weight:500`;
              affixSpan.textContent = affix.name;
              affixEl.appendChild(affixSpan);
            }
          } else {
            affixEl.textContent = "—";
            affixEl.style.color = "#71717a";
          }

          children.push(seasonEl, affixEl);
        }

        tooltipEl.replaceChildren(...children);
        return;
      }

      // Emphasized / single-arc mode — existing behavior
      const idx = bisect(activeArc.rows, xScale.invert(mx));
      const row =
        activeArc.rows[Math.max(0, Math.min(idx, activeArc.rows.length - 1))];
      if (!row) return;

      const activeArcIndex = arcs.indexOf(activeArc);
      hoverCircles.forEach((circle, i) => {
        if (i === activeArcIndex) {
          circle
            .attr("cx", xScale(row.period_index))
            .attr("cy", yScale(row.median_key))
            .attr("r", 5);
        } else {
          circle.attr("r", 0);
        }
      });

      const svgX = MARGIN.left + xScale(row.period_index);
      const cardW = 180;
      const left =
        svgX + cardW + TOOLTIP_OFFSET > container.clientWidth
          ? svgX - cardW - TOOLTIP_OFFSET
          : svgX + TOOLTIP_OFFSET;

      const containerY = TITLE_H + MARGIN.top + my;
      const tooltipH = 120;
      const top = Math.max(TITLE_H + 4, containerY - tooltipH - 12);

      tooltipEl.style.display = "block";
      tooltipEl.style.left = `${left}px`;
      tooltipEl.style.top = `${top}px`;

      const weekEl = document.createElement("div");
      weekEl.style.cssText = `font-size:${FONT.small}px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#71717a`;
      weekEl.textContent = `Week ${row.period_index}`;

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
      const keyColor = cellStyle(delta).bg;

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
      const nameDot = document.createElement("span");
      nameDot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0`;
      const nameLabel = document.createElement("span");
      nameLabel.textContent = seasonLabel;
      nameEl.appendChild(nameDot);
      nameEl.appendChild(nameLabel);

      const affixManifest = getAffixManifest();
      const affixEntries =
        affixManifest[activeArc.season.id]?.[row.period] ?? [];
      const affixEl = document.createElement("div");
      affixEl.style.cssText = `font-size:${FONT.small}px;margin-top:3px;display:flex;flex-wrap:wrap;gap:6px;align-items:center`;
      if (affixEntries.length > 0) {
        for (const affix of affixEntries) {
          const affixSpan = document.createElement("span");
          const impactDelta = activeArc.secondaryAffixImpact.get(affix.id);
          const affixColor = getAffixColor(affix.id, impactDelta);
          affixSpan.style.cssText = `color:${affixColor};font-weight:500`;
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
      hoverCircles.forEach((c) => c.attr("r", 0));
    });
}
