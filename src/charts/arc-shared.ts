import * as d3 from "d3";
import type { SeasonMeta, WeeklyArcRow } from "../types.js";
import { FONT } from "../theme.js";
import { cellStyle } from "./affix-matrix.js";

export type SecondaryAffixImpactMap = Map<number, number>;

// ArcEntry encapsula uma série temporal por season: os dados brutos (rows),
// o índice de cor para d3.schemeTableau10, e o mapa de impacto de afixos
// secundários (usado para colorir afixos nas tooltips, §3.3 do relatório).
export type ArcEntry = {
  season: SeasonMeta;
  rows: WeeklyArcRow[];
  colorIndex: number;
  secondaryAffixImpact: SecondaryAffixImpactMap;
};

export const MARGIN = { top: 20, right: 60, bottom: 50, left: 44 };
export const TOOLTIP_OFFSET = 100;
export const TYRANNICAL_AFFIX_ID = 9;
export const FORTIFIED_AFFIX_ID = 10;
// Alturas reservadas para elementos fora do SVG (título, chips de season, legenda).
// Subtraídas da altura total do container para calcular a altura disponível para o gráfico.
export const TITLE_H = 48;
export const CHIP_H = 36;
export const LEGEND_H = 32;

// Domínio do eixo Y compartilhado entre todos os modos do Arc Chart.
// Inicializado com um fallback razoável; sobrescrito por setKeyDomain() em charts/init.ts
// após calcular o range global real (§4.4 do relatório).
let keyDomain: [number, number] = [0, 40];

export function setKeyDomain(min: number, max: number): void {
  keyDomain = [min, max];
}

export function getKeyDomain(): [number, number] {
  return keyDomain;
}

// Cor do afixo nas tooltips do Arc Chart: afixos primários têm cores fixas (azul/laranja);
// afixos secundários reutilizam a cor do heatmap do Affix Chart via cellStyle(),
// criando codificação visual compartilhada entre as duas views (§3.3 do relatório).
export function getAffixColor(affixId: number, impactDelta?: number): string {
  if (affixId === FORTIFIED_AFFIX_ID) return "#3b82f6";
  if (affixId === TYRANNICAL_AFFIX_ID) return "#f97316";
  if (impactDelta !== undefined) {
    return cellStyle(impactDelta).bg;
  }
  return "#a1a1aa";
}

// Desenha os eixos X e Y do Arc Chart via D3.
// Eixo X: índice relativo de semana (W1, W2...) — não o period_id absoluto,
// pois isso permite comparar seasons de durações diferentes no mesmo espaço (§4.4).
// Eixo Y: mediana de keystone com domínio global fixo (getKeyDomain()).
// Linhas de grade horizontais são adicionadas manualmente para controle de opacidade.
export function drawAxes(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  height: number,
  width: number,
): void {
  const maxPeriods = Math.round(xScale.domain()[1]);

  // Grade horizontal: adicionada antes dos eixos para ficar atrás das linhas de dados.
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
