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

  const width = container.clientWidth || 340;
  const barH = 24;
  const gap = 6;
  const labelW = 96;
  const margin = { top: 8, right: 16, bottom: 8, left: labelW };
  const height = bars.length * (barH + gap) + margin.top + margin.bottom;

  const xScale = d3.scaleLinear()
    .domain([0, d3.max(bars, d => d.avg) ?? 1])
    .range([0, width - margin.left - margin.right]);

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const barG = g.selectAll<SVGGElement, EraBar>('g.bar')
    .data(bars)
    .enter()
    .append('g')
    .attr('class', 'bar')
    .attr('transform', (_, i) => `translate(0,${i * (barH + gap)})`);

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

  if (thisVolume) {
    const thisBar = bars.find(b => b.era === dungeon.era);
    if (thisBar) {
      g.append('rect')
        .attr('transform', `translate(0,${bars.indexOf(thisBar) * (barH + gap)})`)
        .attr('width', xScale(thisVolume.entry_count))
        .attr('height', barH)
        .attr('rx', 3)
        .attr('fill', '#ffffff')
        .attr('opacity', 0.18);
    }
  }
}
