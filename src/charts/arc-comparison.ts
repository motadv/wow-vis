import * as d3 from "d3";
import { getAffixManifest } from "../db/init.js";
import { FONT } from "../theme.js";
import type { DungeonMeta, WeeklyArcRow } from "../types.js";
import { dungeonColor } from "../utils/colors.js";
import { computeWeekLeaders } from "../utils/arc-utils.js";
import { cellStyle } from "./affix-matrix.js";
import {
  MARGIN,
  TOOLTIP_OFFSET,
  TITLE_H,
  CHIP_H,
  TYRANNICAL_AFFIX_ID,
  FORTIFIED_AFFIX_ID,
  getKeyDomain,
  getAffixColor,
  drawAxes,
  type ArcEntry,
} from "./arc-shared.js";

export function renderComparisonView(
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
  const yScale = d3.scaleLinear().domain(getKeyDomain()).range([chartHeight, 0]);

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
