import type { AffixMatrixData, AffixMatrixRow } from "../types.js";
import { FONT } from "../theme.js";
import { scaleDiverging, interpolateRdYlGn, color as d3color } from "d3";

const AFFIX_DESCRIPTIONS: Record<string, string> = {
  Afflicted:
    "Espíritos surgem e lançam um debuff de redução de aceleração e movimento se não forem curados ou dissipados.",
  Awakened:
    "Obeliscos pela masmorra permitem pular pacotes de inimigos e invocam mini-chefes.",
  Beguiling:
    "Emissárias de Azshara surgem com diferentes auras mágicas desafiadoras pela masmorra.",
  Bolstering:
    "Inimigos normais fortalecem a vida e o dano de aliados próximos ao morrerem.",
  Bursting:
    "Inimigos normais mortos causam dano de natureza contínuo e cumulativo a todo o grupo.",
  Encrypted:
    "Relíquias invocam autômatos que concedem diferentes bônus ao grupo quando destruídos.",
  Entangling:
    "Vinhas prendem jogadores periodicamente, exigindo movimento rápido para não causar atordoamento.",
  Explosive:
    "Orbes surgem em combate e explodem causando dano massivo ao grupo se não forem destruídos rapidamente.",
  Fortified:
    "Inimigos normais têm mais vida e causam significativamente mais dano.",
  Grievous:
    "Jogadores feridos sofrem dano contínuo crescente até serem curados acima de 90% da vida.",
  Incorporeal:
    "Seres intangíveis surgem e reduzem drasticamente o dano e a cura do grupo, exigindo feitiços de controle de grupo.",
  Infested:
    "Alguns inimigos possuem um parasita que cura aliados passivamente e salta para outros hospedeiros ao morrer.",
  Inspiring:
    "Certos inimigos emitem uma aura que torna seus aliados próximos imunes a feitiços de controle de grupo.",
  Necrotic:
    "Ataques corpo a corpo de inimigos aplicam um debuff cumulativo que causa dano e reduz a cura recebida pelo alvo.",
  Quaking:
    "Jogadores emitem ondas de choque periodicamente que causam dano a aliados próximos e interrompem lançamentos de feitiços.",
  Raging:
    "Inimigos normais se enfurecem ao atingir 30% de vida, imunes a controle de grupo e causando muito mais dano.",
  Reaping:
    "Inimigos mortos ressurgem em massa como espíritos para atacar o grupo a cada 20% do progresso da masmorra concluído.",
  Sanguine:
    "Inimigos normais mortos deixam poças de sangue no chão que curam inimigos e causam dano aos jogadores.",
  Shrouded:
    "Infiltradores disfarçados entre inimigos concedem um bônus cumulativo de atributos ao grupo quando derrotados.",
  Skittish:
    "Tanques geram consideravelmente menos ameaça, tornando mais difícil manter os inimigos longe dos outros jogadores.",
  Spiteful:
    "Espectros surgem dos cadáveres de inimigos normais e perseguem jogadores aleatórios causando alto dano corpo a corpo.",
  Storming:
    "Tornados surgem periodicamente em combate corpo a corpo, causando dano e repelindo jogadores atingidos.",
  Teeming:
    "Uma quantidade adicional de inimigos normais está presente, exigindo derrotar mais inimigos para concluir a masmorra.",
  Tormented:
    "Tenentes do Carcereiro estão espalhados pela masmorra e concedem poderes de ânima ao grupo quando derrotados.",
  Tyrannical:
    "Chefes das masmorras têm mais vida e causam significativamente mais dano.",
  Volcanic:
    "Erupções vulcânicas surgem periodicamente sob jogadores à distância em combate, causando dano e lançando-os para cima.",
};

// Escala divergente Red-Yellow-Green com domínio [-2, 0, +2].
// Deltas positivos (dungeon mais fácil) → verde; negativos → vermelho; zero → amarelo.
// Valores fora do intervalo são truncados nas extremidades da escala (§3.3 do relatório).
const colorScale = scaleDiverging(interpolateRdYlGn).domain([-2, 0, 2]);

const TYRANNICAL_AFFIX_ID = 9;
const FORTIFIED_AFFIX_ID = 10;

// Tooltip singleton compartilhado entre todas as instâncias do heatmap (modo multi dungeon).
// Um único elemento evita múltiplos tooltips sobrepostos e reduz garbage collection.
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

// cellStyle: calcula cor de fundo e de texto para uma célula do heatmap.
// O texto é escuro (#1a1a22) em células claras (luminância > 0.55) e claro em células escuras,
// garantindo contraste legível em toda a escala RdYlGn (§3.3 do relatório).
// Também usada pelo Arc Chart para colorir afixos nas tooltips — codificação compartilhada.
export function cellStyle(delta: number | null): { bg: string; text: string } {
  if (delta === null) return { bg: "#1a1a22", text: "#2e2e38" };
  const bg = colorScale(Math.max(-2, Math.min(2, delta)));
  const c = d3color(bg)?.rgb();
  const luminance = c ? (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255 : 0.5;
  const text = luminance > 0.55 ? "#1a1a22" : "#e4e4e7";
  return { bg, text };
}

export function buildAffixMatrixData(
  dungeonId: number | null,
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
  if (d > 1) return "much easier";
  if (d > 0.25) return "easier";
  if (d < -1) return "much harder";
  if (d < -0.25) return "harder";
  return "neutral";
}

// Renderiza o heatmap de afixos como uma tabela HTML.
// Usa tabela HTML em vez de SVG porque o layout tabular (linhas × colunas) é
// trivial com CSS e não requer cálculo manual de coordenadas.
// selectedCol controla qual coluna está em destaque — altera opacidade das demais
// e ordena os afixos secundários por magnitude do delta naquela coluna (§3.3).
export function renderAffixMatrix(
  container: HTMLElement,
  data: AffixMatrixData,
  onSeasonSelect: (seasonId: number | null) => void,
  affixOrder?: number[],
  initialSelectedCol?: number | "avg",
): void {
  ensureRowHighlightStyle();
  // Valida que a coluna inicial existe nos dados; cai para "avg" caso contrário.
  let selectedCol: number | "avg" =
    typeof initialSelectedCol === "number" &&
    data.seasonIds.includes(initialSelectedCol)
      ? initialSelectedCol
      : "avg";
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
    subLine.style.cssText = `font-size:${FONT.medium}px;color:#71717a;`;
    subLine.textContent = `${affixName} · ${colLabel}`;

    tooltip.appendChild(valLine);
    tooltip.appendChild(subLine);
    tooltip.style.display = "block";
  }

  function hideTooltip(): void {
    tooltip.style.display = "none";
  }

  function showAffixDescriptionTooltip(row: AffixMatrixRow): void {
    const description = AFFIX_DESCRIPTIONS[row.affixName];
    if (!description) return;
    const labelColor = row.isPrimary
      ? row.isFortified
        ? "#3b82f6"
        : "#f97316"
      : "#a1a1aa";
    tooltip.innerHTML = "";

    const nameLine = document.createElement("div");
    nameLine.style.cssText = `font-size:${FONT.large}px;font-weight:700;color:${labelColor};margin-bottom:5px;`;
    nameLine.textContent = row.affixName;

    const descLine = document.createElement("div");
    descLine.style.cssText = `font-size:${FONT.small}px;color:#d4d4d8;max-width:260px;line-height:1.5;`;
    descLine.textContent = description;

    tooltip.appendChild(nameLine);
    tooltip.appendChild(descLine);
    tooltip.style.display = "block";
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
        if (selectedCol === seasonId) {
          selectedCol = "avg";
          onSeasonSelect(null);
        } else {
          selectedCol = seasonId;
          onSeasonSelect(seasonId);
        }
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
    // Ordenação dos afixos secundários:
    // — affixOrder fornecido (modo multi): ordem global pré-calculada para alinhar linhas.
    // — sem affixOrder: ordena por |delta| da coluna selecionada (afixo mais impactante no topo).
    // Isso implementa a ordenação dinâmica descrita em §3.3 do relatório.
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
    // Highlight sincronizado: ao passar o mouse em uma linha, todas as linhas com o
    // mesmo afixo em outros heatmaps (modo multi dungeon) também são destacadas.
    // querySelectorAll por data-affix-id evita acoplamento entre as instâncias.
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
    if (AFFIX_DESCRIPTIONS[row.affixName]) {
      labelTd.style.cursor = "help";
      labelTd.addEventListener("mouseenter", () =>
        showAffixDescriptionTooltip(row),
      );
      labelTd.addEventListener("mouseleave", hideTooltip);
    }
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
