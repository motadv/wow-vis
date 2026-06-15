import * as d3 from 'd3';
import type { PrimaryAffixTrendPoint } from '../types.js';

export function renderStreamGraph(
  container: HTMLElement,
  data: PrimaryAffixTrendPoint[],
  width: number,
  height: number,
): void {
  if (!data || data.length === 0) {
    container.innerHTML = '<div style="color:#999;text-align:center;padding:20px;">No data available</div>';
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

  // Scales
  const xScale = d3.scaleLinear()
    .domain(d3.extent(data, d => d.period) as [number, number])
    .range([0, innerWidth]);

  const maxMedian = Math.max(...data.map(d => Math.max(d.fortifiedMedian, d.tyrannicalMedian)));
  const yScale = d3.scaleLinear()
    .domain([0, maxMedian * 1.1])
    .range([innerHeight, 0]);

  // Area generators for each stream
  const fortifiedArea = d3.area<PrimaryAffixTrendPoint>()
    .x(d => xScale(d.period))
    .y0(innerHeight)
    .y1(d => yScale(d.fortifiedMedian));

  const tyrannicalArea = d3.area<PrimaryAffixTrendPoint>()
    .x(d => xScale(d.period))
    .y0(d => yScale(d.fortifiedMedian))
    .y1(d => yScale(d.fortifiedMedian + d.tyrannicalMedian));

  // Fortified stream
  svg.append('path')
    .datum(data)
    .attr('d', fortifiedArea)
    .attr('fill', '#3b82f6')
    .attr('opacity', 0.7)
    .attr('class', 'stream-fortified');

  // Tyrannical stream
  svg.append('path')
    .datum(data)
    .attr('d', tyrannicalArea)
    .attr('fill', '#f97316')
    .attr('opacity', 0.7)
    .attr('class', 'stream-tyrannical');

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
    .attr('transform', `translate(${innerWidth - 120},${-15})`);

  legend.append('rect').attr('width', 6).attr('height', 6).attr('fill', '#3b82f6');
  legend.append('text').attr('x', 10).attr('y', 5).attr('font-size', '11px').attr('fill', '#ccc').text('Fortified');

  legend.append('rect').attr('y', 12).attr('width', 6).attr('height', 6).attr('fill', '#f97316');
  legend.append('text').attr('x', 10).attr('y', 17).attr('font-size', '11px').attr('fill', '#ccc').text('Tyrannical');
}
