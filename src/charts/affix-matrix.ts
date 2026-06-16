import type { AffixMatrixData, AffixMatrixRow } from "../types.js";
import { FONT } from "../theme.js";
import { scaleDiverging, interpolateRdYlGn, color as d3color } from "d3";

const colorScale = scaleDiverging(interpolateRdYlGn).domain([-2, 0, 2]);

const TYRANNICAL_AFFIX_ID = 9;
const FORTIFIED_AFFIX_ID = 10;

// Singleton tooltip element shared across renders
let tooltipEl: HTMLElement | null = null;

let rowHighlightStyleInjected = false;

function ensureRowHighlightStyle(): void {
  if (rowHighlightStyleInjected) return;
  const style = document.createElement("style");
  style.textContent = `tr.affix-row-highlight > td:first-child { background: rgba(255,255,255,0.08) !important; border-radius:4px; }`;
  document.head.appendChild(style);
  rowHighlightStyleInjected = true;
}

function ensureTooltip(): HTMLElement {
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.style.cssText = [
      "display:none",
      "position:fixed",
      "background:#1c1c26",
      "border:1px solid #3f3f46",
      "border-radius:6px",
      "padding:10px 16px",
      "pointer-events:none",
      "z-index:9999",
      "box-shadow:0 4px 20px rgba(0,0,0,0.65)",
      "min-width:180px",
      "line-height:1.5",
    ].join(";");
    document.body.appendChild(tooltipEl);
    document.addEventListener("mousemove", (e) => {
      if (tooltipEl && tooltipEl.style.display !== "none") {
        tooltipEl.style.left = `${e.clientX + 16}px`;
        tooltipEl.style.top = `${e.clientY - 10}px`;
      }
    });
  }
  return tooltipEl;
}

export function cellStyle(delta: number | null): { bg: string; text: string } {
  if (delta === null) return { bg: "#1a1a22", text: "#2e2e38" };
  const bg = colorScale(Math.max(-2, Math.min(2, delta)));
  const c = d3color(bg)?.rgb();
  const luminance = c ? (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255 : 0.5;
  const text = luminance > 0.55 ? "#1a1a22" : "#e4e4e7";
  return { bg, text };
}

export function buildAffixMatrixData(
  dungeonId: number,
  seasonIds: number[],
  primaryDeltas: Array<{
    seasonId: number;
    fortifiedDelta: number;
    tyrannicalDelta: number;
  }>,
  secondaryData: Array<{
    affixId: number;
    affixName: string;
    cells: Record<number, number>;
    avgDelta: number;
  }>,
): AffixMatrixData {
  const tyrannicalCells: Record<number, number | null> = Object.fromEntries(
    seasonIds.map((s) => [s, null]),
  );
  const fortifiedCells: Record<number, number | null> = Object.fromEntries(
    seasonIds.map((s) => [s, null]),
  );

  for (const { seasonId, fortifiedDelta, tyrannicalDelta } of primaryDeltas) {
    tyrannicalCells[seasonId] = tyrannicalDelta;
    fortifiedCells[seasonId] = fortifiedDelta;
  }

  const mean = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const primaryRows: AffixMatrixRow[] = [
    {
      affixId: TYRANNICAL_AFFIX_ID,
      affixName: "Tyrannical",
      isPrimary: true,
      isFortified: false,
      cells: tyrannicalCells,
      avgDelta: mean(primaryDeltas.map((d) => d.tyrannicalDelta)),
    },
    {
      affixId: FORTIFIED_AFFIX_ID,
      affixName: "Fortified",
      isPrimary: true,
      isFortified: true,
      cells: fortifiedCells,
      avgDelta: mean(primaryDeltas.map((d) => d.fortifiedDelta)),
    },
  ];

  const secondaryRows: AffixMatrixRow[] = secondaryData
    .map(({ affixId, affixName, cells, avgDelta }) => ({
      affixId,
      affixName,
      isPrimary: false as const,
      cells: Object.fromEntries(
        seasonIds.map((s) => [s, cells[s] ?? null]),
      ) as Record<number, number | null>,
      avgDelta,
    }))
    .sort((a, b) => Math.abs(b.avgDelta) - Math.abs(a.avgDelta));

  return { dungeonId, seasonIds, rows: [...primaryRows, ...secondaryRows] };
}

function fmt(d: number | null): string {
  if (d === null) return "—";
  return (d >= 0 ? "+" : "") + d.toFixed(2);
}

function directionLabel(d: number | null): string {
  if (d === null) return "no data";
  if (d > 0.08) return "easier";
  if (d < -0.08) return "harder";
  return "neutral";
}

export function renderAffixMatrix(
  container: HTMLElement,
  data: AffixMatrixData,
  onSeasonSelect: (seasonId: number | null) => void,
  affixOrder?: number[],
): void {
  ensureRowHighlightStyle();
  let selectedCol: number | "avg" = "avg";
  const tooltip = ensureTooltip();

  function showTooltip(
    affixName: string,
    colLabel: string,
    val: number | null,
  ): void {
    const st = cellStyle(val);
    tooltip.innerHTML = "";

    const valLine = document.createElement("div");
    valLine.style.cssText = `font-size:${FONT.large}px;font-weight:700;color:${st.bg};margin-bottom:3px;`;
    valLine.textContent = `${fmt(val)} keys (${directionLabel(val)})`;

    const subLine = document.createElement("div");
    subLine.style.cssText = `font-size:${FONT.small}px;color:#71717a;`;
    subLine.textContent = `${affixName} · ${colLabel}`;

    tooltip.appendChild(valLine);
    tooltip.appendChild(subLine);
    tooltip.style.display = "block";
  }

  function hideTooltip(): void {
    tooltip.style.display = "none";
  }

  function render(): void {
    container.innerHTML = "";
    hideTooltip();

    const table = document.createElement("table");
    // No width:100% — let the table size naturally so label column isn't stretched
    table.style.cssText = "border-collapse:separate;border-spacing:3px;";

    // ── Header row ──
    const thead = document.createElement("thead");
    const hRow = document.createElement("tr");

    // Empty header cell for label column — reserve width so labels aren't stretched
    const labelTh = document.createElement("th");
    labelTh.style.cssText = "min-width:100px;";
    hRow.appendChild(labelTh);

    for (const seasonId of data.seasonIds) {
      const th = document.createElement("th");
      th.textContent = `S${seasonId}`;
      const isActive = selectedCol === seasonId;
      th.style.cssText = [
        "min-width:72px",
        "padding:6px 8px",
        `font-size:${FONT.medium}px`,
        "font-weight:700",
        "text-align:center",
        "cursor:pointer",
        "border-radius:4px",
        `color:${isActive ? "#93c5fd" : "#71717a"}`,
        `background:${isActive ? "rgba(59,130,246,0.15)" : "transparent"}`,
      ].join(";");
      th.onclick = () => {
        selectedCol = seasonId;
        onSeasonSelect(seasonId);
        render();
      };
      hRow.appendChild(th);
    }

    const avgTh = document.createElement("th");
    avgTh.textContent = "AVG";
    const avgActive = selectedCol === "avg";
    avgTh.style.cssText = [
      "min-width:72px",
      "padding:6px 12px",
      `font-size:${FONT.medium}px`,
      "font-weight:700",
      "text-align:center",
      "cursor:pointer",
      "border-radius:4px",
      "border-left:2px solid #27272a",
      `color:${avgActive ? "#c4b5fd" : "#71717a"}`,
      `background:${avgActive ? "rgba(139,92,246,0.18)" : "transparent"}`,
    ].join(";");
    avgTh.onclick = () => {
      selectedCol = "avg";
      onSeasonSelect(null);
      render();
    };
    hRow.appendChild(avgTh);
    thead.appendChild(hRow);
    table.appendChild(thead);

    // ── Body ──
    const tbody = document.createElement("tbody");

    const primaryRows = data.rows.filter((r) => r.isPrimary);
    const secondaryUnsorted = data.rows.filter((r) => !r.isPrimary);
    const secondaryRows = affixOrder
      ? [...secondaryUnsorted].sort((a, b) => {
          const ai = affixOrder.indexOf(a.affixId);
          const bi = affixOrder.indexOf(b.affixId);
          const aPos = ai === -1 ? Infinity : ai;
          const bPos = bi === -1 ? Infinity : bi;
          return aPos - bPos;
        })
      : [...secondaryUnsorted].sort((a, b) => {
          const aVal =
            selectedCol === "avg"
              ? (a.avgDelta ?? 0)
              : (a.cells[selectedCol as number] ?? 0);
          const bVal =
            selectedCol === "avg"
              ? (b.avgDelta ?? 0)
              : (b.cells[selectedCol as number] ?? 0);
          return Math.abs(bVal) - Math.abs(aVal);
        });

    appendSectionLabel(tbody, "PRIMARY", false);
    for (const row of primaryRows) appendDataRow(tbody, row);

    appendSectionLabel(tbody, "SECONDARY", true);
    for (const row of secondaryRows) appendDataRow(tbody, row);

    table.appendChild(tbody);
    container.appendChild(table);
  }

  function appendSectionLabel(
    tbody: HTMLElement,
    label: string,
    withTopBorder: boolean,
  ): void {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = data.seasonIds.length + 2;
    td.style.cssText = [
      `font-size:${FONT.tiny}px`,
      "font-weight:700",
      "letter-spacing:1.4px",
      "text-transform:uppercase",
      "color:#e4e4e7",
      "text-align:right",
      "padding:12px 12px 3px 0",
      withTopBorder ? "border-top:1px solid #27272a" : "",
    ]
      .filter(Boolean)
      .join(";");
    td.textContent = label;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function appendDataRow(tbody: HTMLElement, row: AffixMatrixRow): void {
    const tr = document.createElement("tr");
    tr.dataset.affixId = String(row.affixId);
    tr.addEventListener("mouseenter", () => {
      document
        .querySelectorAll<HTMLElement>(`tr[data-affix-id="${row.affixId}"]`)
        .forEach((el) => el.classList.add("affix-row-highlight"));
    });
    tr.addEventListener("mouseleave", () => {
      document
        .querySelectorAll<HTMLElement>(`tr[data-affix-id="${row.affixId}"]`)
        .forEach((el) => el.classList.remove("affix-row-highlight"));
    });

    const labelTd = document.createElement("td");
    const labelColor = row.isPrimary
      ? row.isFortified
        ? "#3b82f6"
        : "#f97316"
      : "#a1a1aa";
    labelTd.style.cssText = [
      "padding:0 14px 0 0",
      `font-size:${FONT.medium}px`,
      "font-weight:500",
      "text-align:right",
      "white-space:nowrap",
      "vertical-align:middle",
      `color:${labelColor}`,
    ].join(";");
    labelTd.textContent = row.affixName;
    tr.appendChild(labelTd);

    for (const seasonId of data.seasonIds) {
      const val = row.cells[seasonId] ?? null;
      const st = cellStyle(val);
      const dim = selectedCol !== "avg" && selectedCol !== seasonId;
      const td = document.createElement("td");
      td.style.cssText = [
        "width:72px",
        "height:28px",
        "border-radius:4px",
        "text-align:center",
        `font-size:${FONT.small}px`,
        "font-weight:700",
        "vertical-align:middle",
        "font-variant-numeric:tabular-nums",
        "cursor:default",
        `background:${st.bg}`,
        `color:${st.text}`,
        `opacity:${dim ? "0.2" : "1"}`,
        "transition:opacity 0.18s",
      ].join(";");
      td.textContent = fmt(val);
      td.addEventListener("mouseenter", () =>
        showTooltip(row.affixName, `S${seasonId}`, val),
      );
      td.addEventListener("mouseleave", hideTooltip);
      tr.appendChild(td);
    }

    const avgSt = cellStyle(row.avgDelta);
    const avgDim = selectedCol !== "avg";
    const avgTd = document.createElement("td");
    avgTd.style.cssText = [
      "width:72px",
      "height:28px",
      "border-radius:4px",
      "text-align:center",
      `font-size:${FONT.medium}px`,
      "font-weight:800",
      "vertical-align:middle",
      "font-variant-numeric:tabular-nums",
      "cursor:default",
      "border-left:2px solid #27272a",
      `background:${avgSt.bg}`,
      `color:${avgSt.text}`,
      `opacity:${avgDim ? "0.2" : "1"}`,
      "transition:opacity 0.18s",
    ].join(";");
    avgTd.textContent = fmt(row.avgDelta);
    avgTd.addEventListener("mouseenter", () =>
      showTooltip(row.affixName, "Average (all seasons)", row.avgDelta),
    );
    avgTd.addEventListener("mouseleave", hideTooltip);
    tr.appendChild(avgTd);

    tbody.appendChild(tr);
  }

  render();
}
