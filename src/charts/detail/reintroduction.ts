import * as d3 from 'd3';
import type { DungeonMeta, KeyDistRow } from '../../types';

export interface SeasonSnapshot {
  seasonId: number;
  seasonName: string;
  isFirstAppearance: boolean;
  alwaysInPool: boolean;
  distribution: KeyDistRow[];
  maxKey: number;
  entryCount: number;
}

export function renderReintroductionView(
  container: HTMLElement,
  _dungeon: DungeonMeta,
  snapshots: SeasonSnapshot[],
): void {
  while (container.firstChild) container.removeChild(container.firstChild);

  if (snapshots.length === 0) {
    const p = document.createElement('p');
    Object.assign(p.style, { color: '#71717a', padding: '16px', fontSize: '13px' });
    p.textContent = 'No season data available.';
    container.appendChild(p);
    return;
  }

  if (snapshots[0]?.alwaysInPool) {
    const warn = document.createElement('p');
    Object.assign(warn.style, { color: '#F59E0B', padding: '8px 16px', fontSize: '12px', margin: '0' });
    warn.textContent = 'Always in pool — reintroduction comparison not applicable.';
    container.appendChild(warn);
  }

  const allLevels = snapshots.flatMap(s => s.distribution.map(r => r.keystone_level));
  const xDomain: [number, number] = [d3.min(allLevels) ?? 0, d3.max(allLevels) ?? 1];

  const chartWidth = 140;
  const chartHeight = 80;
  const xPad = 8;

  const wrap = document.createElement('div');
  Object.assign(wrap.style, { display: 'flex', flexWrap: 'wrap', gap: '16px', padding: '12px 16px' });
  container.appendChild(wrap);

  for (const snap of snapshots) {
    const cell = document.createElement('div');
    Object.assign(cell.style, { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' });

    const color = snap.isFirstAppearance ? '#60A5FA' : '#A78BFA';

    const label = document.createElement('span');
    Object.assign(label.style, { fontSize: '11px', fontWeight: '600', color });
    label.textContent = snap.isFirstAppearance ? 'First Appearance' : 'Reintroduction';
    cell.appendChild(label);

    const seasonSpan = document.createElement('span');
    Object.assign(seasonSpan.style, { fontSize: '10px', color: '#71717a' });
    seasonSpan.textContent = snap.seasonName;
    cell.appendChild(seasonSpan);

    const xScale = d3.scaleLinear().domain(xDomain).range([xPad, chartWidth - xPad]);
    const yMax = d3.max(snap.distribution, r => r.count) ?? 1;
    const yScale = d3.scaleLinear().domain([0, yMax]).range([chartHeight, 0]);
    const barW = Math.max(2, (chartWidth - xPad * 2) / Math.max(1, snap.distribution.length) - 1);

    const svg = d3.select(cell).append('svg')
      .attr('width', chartWidth)
      .attr('height', chartHeight);

    svg.selectAll<SVGRectElement, KeyDistRow>('rect')
      .data(snap.distribution)
      .enter()
      .append('rect')
      .attr('x', d => xScale(d.keystone_level) - barW / 2)
      .attr('y', d => yScale(d.count))
      .attr('width', barW)
      .attr('height', d => chartHeight - yScale(d.count))
      .attr('fill', color)
      .attr('opacity', 0.8);

    const caption = document.createElement('span');
    Object.assign(caption.style, { fontSize: '10px', color: '#71717a' });
    caption.textContent = `max ${snap.maxKey} · n=${snap.entryCount}`;
    cell.appendChild(caption);

    wrap.appendChild(cell);
  }
}
