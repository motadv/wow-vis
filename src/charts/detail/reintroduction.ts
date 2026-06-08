import * as d3 from 'd3';
import type { DungeonMeta, KeyDistRow } from '../../types.js';

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
  container.replaceChildren();

  const section = document.createElement('div');
  section.style.cssText = 'padding:16px';

  if (snapshots.length > 0 && snapshots[0].alwaysInPool) {
    const warn = document.createElement('p');
    warn.style.cssText = 'margin:0 0 12px;padding:8px 10px;border-radius:4px;background:#78350f33;border:1px solid #d97706;color:#fbbf24;font-size:12px';
    warn.textContent = 'This dungeon has appeared in every season — no reintroduction effect to measure.';
    section.appendChild(warn);
  }

  const allKeys = snapshots.flatMap(s => s.distribution.map(r => r.keystone_level));
  const xDomain: [number, number] = allKeys.length > 0
    ? [d3.min(allKeys)!, d3.max(allKeys)!]
    : [2, 30];

  const W = 180, H = 64, marginLeft = 24, marginBottom = 16;

  for (const snap of snapshots) {
    const card = document.createElement('div');
    card.style.cssText = 'margin-bottom:16px';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px';

    const title = document.createElement('span');
    title.style.cssText = `font-size:12px;font-weight:600;color:${snap.isFirstAppearance ? '#60a5fa' : '#c084fc'}`;
    title.textContent = snap.seasonName;
    header.appendChild(title);

    const badge = document.createElement('span');
    badge.style.cssText = `font-size:10px;padding:1px 6px;border-radius:10px;background:${snap.isFirstAppearance ? '#1e3a5f' : '#3b1f5e'};color:${snap.isFirstAppearance ? '#93c5fd' : '#d8b4fe'}`;
    badge.textContent = snap.isFirstAppearance ? 'First appearance' : 'Reintroduced';
    header.appendChild(badge);

    card.appendChild(header);

    const svg = d3.create('svg')
      .attr('width', W + marginLeft)
      .attr('height', H + marginBottom)
      .attr('viewBox', `0 0 ${W + marginLeft} ${H + marginBottom}`);

    const maxCount = d3.max(snap.distribution, d => d.count) ?? 1;
    const x = d3.scaleLinear().domain(xDomain).range([0, W]);
    const y = d3.scaleLinear().domain([0, maxCount]).range([H, 0]);
    const barColor = snap.isFirstAppearance ? '#3b82f6' : '#9333ea';

    const g = svg.append('g').attr('transform', `translate(${marginLeft},0)`);

    g.selectAll('rect')
      .data(snap.distribution)
      .join('rect')
      .attr('x', d => x(d.keystone_level) - (W / (xDomain[1] - xDomain[0])) / 2)
      .attr('y', d => y(d.count))
      .attr('width', Math.max(1, W / (xDomain[1] - xDomain[0]) - 1))
      .attr('height', d => H - y(d.count))
      .attr('fill', barColor)
      .attr('opacity', 0.85);

    g.append('g')
      .attr('transform', `translate(0,${H})`)
      .call(d3.axisBottom(x).ticks(5).tickSize(2))
      .call(ax => ax.select('.domain').attr('stroke', '#3f3f46'))
      .call(ax => ax.selectAll('text').attr('fill', '#71717a').attr('font-size', 9))
      .call(ax => ax.selectAll('line').attr('stroke', '#3f3f46'));

    card.appendChild(svg.node()!);

    const caption = document.createElement('p');
    caption.style.cssText = 'margin:2px 0 0;font-size:10px;color:#71717a';
    caption.textContent = `max key ${snap.maxKey} · n=${snap.entryCount}`;
    card.appendChild(caption);

    section.appendChild(card);
  }

  container.appendChild(section);
}
