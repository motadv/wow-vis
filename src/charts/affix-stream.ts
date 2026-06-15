import * as d3 from 'd3';
import type { PrimaryAffixTrendPoint } from '../types.js';

export function renderStreamGraph(
  container: HTMLElement,
  data: PrimaryAffixTrendPoint[],
  width: number,
  height: number,
): void {
  if (!data || data.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.style.cssText = 'color:#999;text-align:center;padding:20px;';
    emptyDiv.textContent = 'No data available';
    container.appendChild(emptyDiv);
    return;
  }

  container.innerHTML = '';

  const margin = { top: 20, right: 20, bottom: 30, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Detect if this is War Within data (both affixes present) or pre-War Within (split affixes)
  const isWarWithin = data.some(d => 'combinedMedian' in d && (d as any).combinedMedian !== undefined);

  // Scales
  const xScale = d3.scaleLinear()
    .domain(d3.extent(data, d => d.period) as [number, number])
    .range([0, innerWidth]);

  let yScale: d3.ScaleLinear<number, number>;
  let line: d3.Line<PrimaryAffixTrendPoint>;
  let legendInfo: { label: string; color: string }[];

  if (isWarWithin) {
    // War Within: Single line showing combined median
    const maxMedian = Math.max(...data.map(d => (d as any).combinedMedian || 0));
    yScale = d3.scaleLinear()
      .domain([0, maxMedian * 1.1])
      .range([innerHeight, 0]);

    line = d3.line<PrimaryAffixTrendPoint>()
      .x(d => xScale(d.period))
      .y(d => yScale((d as any).combinedMedian || 0));

    // Draw single line
    svg.append('path')
      .datum(data)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', '#8b5cf6')
      .attr('stroke-width', 2)
      .attr('class', 'trend-line');

    legendInfo = [{ label: 'Median Key Level (both affixes active)', color: '#8b5cf6' }];
  } else {
    // Pre-War Within: Stacked area chart for Fortified vs Tyrannical
    const maxMedian = Math.max(...data.map(d => Math.max(d.fortifiedMedian, d.tyrannicalMedian)));
    yScale = d3.scaleLinear()
      .domain([0, maxMedian * 1.1])
      .range([innerHeight, 0]);

    const fortifiedArea = d3.area<PrimaryAffixTrendPoint>()
      .x(d => xScale(d.period))
      .y0(innerHeight)
      .y1(d => yScale(d.fortifiedMedian));

    const tyrannicalArea = d3.area<PrimaryAffixTrendPoint>()
      .x(d => xScale(d.period))
      .y0(d => yScale(d.fortifiedMedian))
      .y1(d => yScale(d.fortifiedMedian + d.tyrannicalMedian));

    svg.append('path')
      .datum(data)
      .attr('d', fortifiedArea)
      .attr('fill', '#3b82f6')
      .attr('opacity', 0.7)
      .attr('class', 'stream-fortified');

    svg.append('path')
      .datum(data)
      .attr('d', tyrannicalArea)
      .attr('fill', '#f97316')
      .attr('opacity', 0.7)
      .attr('class', 'stream-tyrannical');

    legendInfo = [
      { label: 'Fortified', color: '#3b82f6' },
      { label: 'Tyrannical', color: '#f97316' },
    ];
  }

  // Axes
  svg.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale).tickFormat(d => `W${d}`));

  svg.append('g')
    .call(d3.axisLeft(yScale));

  // Axis labels
  svg.append('text')
    .attr('x', innerWidth / 2)
    .attr('y', innerHeight + margin.bottom - 5)
    .attr('text-anchor', 'middle')
    .attr('font-size', '12px')
    .attr('fill', '#999')
    .text('Week');

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', 0 - margin.left + 12)
    .attr('x', 0 - innerHeight / 2)
    .attr('text-anchor', 'middle')
    .attr('font-size', '12px')
    .attr('fill', '#999')
    .text('Median Key Level');

  // Legend
  const legend = svg.append('g')
    .attr('transform', `translate(${innerWidth - 180},${-15})`);

  for (let i = 0; i < legendInfo.length; i++) {
    const item = legendInfo[i];
    legend.append('rect')
      .attr('y', i * 12)
      .attr('width', 6)
      .attr('height', 6)
      .attr('fill', item.color);
    legend.append('text')
      .attr('x', 10)
      .attr('y', i * 12 + 5)
      .attr('font-size', '11px')
      .attr('fill', '#ccc')
      .text(item.label);
  }
}
