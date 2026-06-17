import * as d3 from "d3";
import { getAffixManifest } from "../db/init.js";
import { setState } from "../state.js";
import { FONT } from "../theme.js";
import type { WeeklyArcRow } from "../types.js";
import { cellStyle } from "./affix-matrix.js";
import { collectAtWeek } from "../utils/arc-utils.js";
import {
  MARGIN,
  TOOLTIP_OFFSET,
  TITLE_H,
  getKeyDomain,
  getAffixColor,
  drawAxes,
  type ArcEntry,
} from "./arc-shared.js";

export function renderArc(
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
  const yScale = d3.scaleLinear().domain(getKeyDomain()).range([height, 0]);

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
  drawTooltip(g, arcs, xScale, yScale, width, height, emphasizedSeasonId, colors, container);
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
  const bisect = d3.bisector<WeeklyArcRow, number>((r) => r.period_index).center;

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

      // Emphasized / single-arc mode
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
      const affixEntries = affixManifest[activeArc.season.id]?.[row.period] ?? [];
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
