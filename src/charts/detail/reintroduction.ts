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

  const wrap = document.createElement('div');
  Object.assign(wrap.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    padding: '12px 16px',
  });
  container.appendChild(wrap);

  const panelW = (container.clientWidth || 548) - 32;
  const chartH = 120;
  const margin = { top: 4, right: 15, bottom: 38, left: 15 };
  const innerW = panelW - margin.left - margin.right;
  const innerH = chartH - margin.top - margin.bottom;

  for (const snap of snapshots) {
    const cell = document.createElement('div');
    Object.assign(cell.style, { display: 'flex', flexDirection: 'column', gap: '2px' });

    const color = snap.isFirstAppearance ? '#60A5FA' : '#A78BFA';

    // Header row: type label left, stats right
    const headerRow = document.createElement('div');
    Object.assign(headerRow.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
    });

    const typeLabel = document.createElement('span');
    Object.assign(typeLabel.style, { fontSize: '15px', fontWeight: '600', color });
    typeLabel.textContent = snap.isFirstAppearance ? 'First Appearance' : 'Reintroduction';

    const statsLabel = document.createElement('span');
    Object.assign(statsLabel.style, { fontSize: '13px', color: '#71717a' });
    statsLabel.textContent = `max ${snap.maxKey} · n=${snap.entryCount}`;

    headerRow.appendChild(typeLabel);
    headerRow.appendChild(statsLabel);
    cell.appendChild(headerRow);

    // Season name subline
    const seasonSpan = document.createElement('span');
    Object.assign(seasonSpan.style, { fontSize: '13px', color: '#71717a' });
    seasonSpan.textContent = snap.seasonName;
    cell.appendChild(seasonSpan);

    // SVG histogram
    const xScale = d3.scaleLinear().domain(xDomain).range([0, innerW]);
    const yMax = d3.max(snap.distribution, r => r.count) ?? 1;
    const yScale = d3.scaleLinear().domain([0, yMax]).range([innerH, 0]);
    const barW = Math.max(2, innerW / Math.max(1, snap.distribution.length) - 1);

    const svgH = margin.top + innerH + margin.bottom;
    const svg = d3.select(cell)
      .append('svg')
      .attr('width', panelW)
      .attr('height', svgH);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Horizontal gridlines at 25%, 50%, 75% of innerH (drawn behind bars)
    [0.25, 0.5, 0.75].forEach(frac => {
      g.append('line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', innerH * (1 - frac)).attr('y2', innerH * (1 - frac))
        .attr('stroke', '#3f3f46')
        .attr('stroke-width', 0.5);
    });

    // Bars
    g.selectAll<SVGRectElement, KeyDistRow>('rect')
      .data(snap.distribution)
      .enter()
      .append('rect')
      .attr('x', d => xScale(d.keystone_level) - barW / 2)
      .attr('y', d => yScale(d.count))
      .attr('width', barW)
      .attr('height', d => innerH - yScale(d.count))
      .attr('fill', color)
      .attr('opacity', 0.8);

    // X-axis
    const xAxis = d3.axisBottom(xScale)
      .ticks(5)
      .tickFormat(d => String(Math.round(d as number)));

    const axisG = g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis);

    axisG.select('.domain').remove();
    axisG.selectAll('.tick line').attr('stroke', '#3f3f46');
    axisG.selectAll<SVGTextElement, unknown>('.tick text')
      .attr('fill', '#52525b')
      .attr('font-size', 13);

    // Axis label
    g.append('text')
      .attr('x', innerW / 2)
      .attr('y', innerH + 32)
      .attr('text-anchor', 'middle')
      .attr('fill', '#52525b')
      .attr('font-size', 13)
      .text('Key level');

    wrap.appendChild(cell);
  }
}
