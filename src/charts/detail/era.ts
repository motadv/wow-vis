import * as d3 from 'd3';
import type { DungeonMeta, DungeonManifest, VolumeRow } from '../../types';
import { ERA_PALETTE, ERA_LABELS, ERAS_IN_ORDER } from '../../config';

type EraBar = { era: string; avg: number };

export function renderEraView(
  container: HTMLElement,
  dungeon: DungeonMeta,
  thisVolume: VolumeRow | undefined,
  allVolume: VolumeRow[],
  manifest: DungeonManifest,
): void {
  while (container.firstChild) container.removeChild(container.firstChild);

  const eraTotal = new Map<string, { sum: number; count: number }>();
  for (const row of allVolume) {
    const d = manifest.dungeons.find(x => x.id === row.dungeon_id);
    if (!d) continue;
    const acc = eraTotal.get(d.era) ?? { sum: 0, count: 0 };
    acc.sum += row.entry_count;
    acc.count += 1;
    eraTotal.set(d.era, acc);
  }

  const bars: EraBar[] = ERAS_IN_ORDER
    .filter(e => eraTotal.has(e))
    .map(e => ({ era: e, avg: eraTotal.get(e)!.sum / eraTotal.get(e)!.count }))
    .sort((a, b) => b.avg - a.avg);

  const width = container.clientWidth || 448;
  const barH = 24;
  const gap = 6;
  const labelW = 104;
  const margin = { top: 8, right: 56, bottom: 32, left: labelW };
  const innerW = width - margin.left - margin.right;
  const barsH = bars.length * (barH + gap) - gap;

  const xScale = d3.scaleLinear()
    .domain([0, d3.max(bars, d => d.avg) ?? 1])
    .range([0, innerW]);

  const axisY = barsH + 8;
  const height = axisY + margin.bottom;

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // Vertical gridlines — drawn first (behind everything)
  const tickVals = xScale.ticks(4);
  g.selectAll<SVGLineElement, number>('line.grid')
    .data(tickVals)
    .enter()
    .append('line')
    .attr('class', 'grid')
    .attr('x1', d => xScale(d))
    .attr('x2', d => xScale(d))
    .attr('y1', 0)
    .attr('y2', barsH)
    .attr('stroke', '#3f3f46')
    .attr('stroke-width', 1);

  const barG = g.selectAll<SVGGElement, EraBar>('g.bar')
    .data(bars)
    .enter()
    .append('g')
    .attr('class', 'bar')
    .attr('transform', (_, i) => `translate(0,${i * (barH + gap)})`);

  // Background rect masks gridlines inside each bar's row
  barG.append('rect')
    .attr('width', innerW)
    .attr('height', barH)
    .attr('fill', '#18181b');

  barG.append('rect')
    .attr('width', d => xScale(d.avg))
    .attr('height', barH)
    .attr('rx', 3)
    .attr('fill', d => ERA_PALETTE[d.era as keyof typeof ERA_PALETTE] ?? '#52525b')
    .attr('opacity', d => d.era === dungeon.era ? 1 : 0.45);

  barG.append('text')
    .attr('x', -8)
    .attr('y', barH / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', 'end')
    .attr('fill', '#a1a1aa')
    .attr('font-size', 12)
    .text(d => ERA_LABELS[d.era as keyof typeof ERA_LABELS] ?? d.era);

  barG.append('text')
    .attr('x', d => xScale(d.avg) + 6)
    .attr('y', barH / 2)
    .attr('dy', '0.35em')
    .attr('fill', '#71717a')
    .attr('font-size', 11)
    .text(d => `avg ${Math.round(d.avg)}`);

  // Selected dungeon's own value overlay
  if (thisVolume) {
    const thisBar = bars.find(b => b.era === dungeon.era);
    if (thisBar) {
      g.append('rect')
        .attr('transform', `translate(0,${bars.indexOf(thisBar) * (barH + gap)})`)
        .attr('width', xScale(thisVolume.entry_count))
        .attr('height', barH)
        .attr('rx', 3)
        .attr('fill', '#ffffff')
        .attr('opacity', 0.28);
    }
  }

  // X-axis
  const xAxis = d3.axisBottom(xScale)
    .ticks(4)
    .tickFormat(d => d3.format('~s')(d as number));

  const axisG = g.append('g')
    .attr('transform', `translate(0,${axisY})`)
    .call(xAxis);

  axisG.select('.domain').attr('stroke', '#3f3f46');
  axisG.selectAll('.tick line').attr('stroke', '#3f3f46');
  axisG.selectAll<SVGTextElement, unknown>('.tick text')
    .attr('fill', '#52525b')
    .attr('font-size', 10);

  // Axis label
  g.append('text')
    .attr('x', innerW / 2)
    .attr('y', axisY + 28)
    .attr('text-anchor', 'middle')
    .attr('fill', '#52525b')
    .attr('font-size', 10)
    .text('Avg completions');
}
