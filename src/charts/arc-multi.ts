import * as d3 from "d3";
import { FONT } from "../theme.js";
import type { DungeonMeta, SeasonMeta } from "../types.js";
import { dungeonColor } from "../utils/colors.js";
import { computeAverageArc } from "../utils/arc-utils.js";
import {
  MARGIN,
  TOOLTIP_OFFSET,
  TITLE_H,
  CHIP_H,
  LEGEND_H,
  getKeyDomain,
  drawAxes,
  type ArcEntry,
} from "./arc-shared.js";
import { renderComparisonView } from "./arc-comparison.js";

export function renderMultiArc(
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
  legendEl.style.cssText = "padding:6px 16px 4px;display:flex;gap:16px;flex-wrap:wrap;";
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

  const allSeasonRows: ArcEntry[] = [];
  for (const entries of dungeonData.values()) allSeasonRows.push(...entries);
  if (allSeasonRows.length === 0 || allSeasonRows.every((e) => e.rows.length === 0)) return;

  const sharedSeasonIdSet = new Set(sharedSeasons.map((s) => s.id));
  const sharedRows = allSeasonRows.filter((e) => sharedSeasonIdSet.has(e.season.id));
  const rowsForDomain = sharedRows.length > 0 ? sharedRows : allSeasonRows;
  const maxPeriods = Math.max(...rowsForDomain.flatMap((e) => e.rows.map((r) => r.period_index)));

  if (comparisonSeasonId !== null) {
    renderComparisonView(container, dungeons, dungeonData, comparisonSeasonId, maxPeriods, affixImpactCache);
    return;
  }

  const chipOffset = sharedSeasons.length > 0 ? CHIP_H : 0;
  const totalTitleH = TITLE_H + LEGEND_H;
  const width = container.clientWidth - MARGIN.left - MARGIN.right;
  const height =
    container.clientHeight - MARGIN.top - MARGIN.bottom - totalTitleH - chipOffset;

  const xScale = d3.scaleLinear().domain([1, maxPeriods]).range([0, width]);
  const yScale = d3.scaleLinear().domain(getKeyDomain()).range([height, 0]);

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
    const allEntries = dungeonData.get(dungeon.id) ?? [];
    const sharedEntries = allEntries.filter((e) => sharedSeasonIdSet.has(e.season.id));

    for (const { rows } of sharedEntries) {
      if (rows.length === 0) continue;
      g.append("path")
        .datum(rows as ArcPoint[])
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 1.2)
        .attr("opacity", 0.35)
        .attr("d", lineGen);
    }

    const avgRows = computeAverageArc(allEntries.map((e) => e.rows));
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
