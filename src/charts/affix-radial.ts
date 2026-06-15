import * as d3 from 'd3';
import type { SecondaryAffixImpact } from '../types.js';

export function renderRadialChart(
  container: HTMLElement,
  data: SecondaryAffixImpact[],
  size: number = 200,
): void {
  if (!data || data.length === 0) {
    container.innerHTML = '<div style="color:#999;text-align:center;padding:20px;">No affix data</div>';
    return;
  }

  container.innerHTML = '';

  const radius = size / 2;
  const centerX = size / 2;
  const centerY = size / 2;

  // Color scale for affixes (red for harder, green for easier)
  const colorScale = d3.scaleLinear<string>()
    .domain([-Math.max(...data.map(d => Math.abs(d.impactDelta))), 0, Math.max(...data.map(d => Math.abs(d.impactDelta)))])
    .range(['#10b981', '#999', '#ef4444']);

  // Scale impact delta to arm length (max radius = 0.7 * radius)
  const maxImpact = Math.max(...data.map(d => Math.abs(d.impactDelta)));
  const armScale = d3.scaleLinear()
    .domain([0, maxImpact])
    .range([5, radius * 0.7]);

  // Position arms around circle
  const angleScale = d3.scaleLinear()
    .domain([0, data.length])
    .range([0, Math.PI * 2]);

  const svg = d3.select(container)
    .append('svg')
    .attr('width', size)
    .attr('height', size)
    .attr('viewBox', `0 0 ${size} ${size}`)
    .style('overflow', 'visible');

  // Center circle (baseline)
  svg.append('circle')
    .attr('cx', centerX)
    .attr('cy', centerY)
    .attr('r', 6)
    .attr('fill', '#666')
    .attr('stroke', '#999')
    .attr('stroke-width', 1);

  // Radial arms for each affix
  const armsGroup = svg.append('g').attr('class', 'affix-arms');

  data.forEach((affix, i) => {
    const angle = angleScale(i);
    const armLength = armScale(Math.abs(affix.impactDelta));

    // Convert polar to cartesian
    const x2 = centerX + Math.cos(angle - Math.PI / 2) * armLength;
    const y2 = centerY + Math.sin(angle - Math.PI / 2) * armLength;

    // Draw arm line
    armsGroup.append('line')
      .attr('x1', centerX)
      .attr('y1', centerY)
      .attr('x2', x2)
      .attr('y2', y2)
      .attr('stroke', colorScale(affix.impactDelta))
      .attr('stroke-width', Math.max(2, armLength / 15))
      .attr('stroke-linecap', 'round')
      .attr('opacity', 0.8)
      .attr('class', 'affix-arm')
      .attr('data-affix-id', affix.affixId.toString());

    // Add label on hover (invisible initially)
    const labelX = centerX + Math.cos(angle - Math.PI / 2) * (armLength + 20);
    const labelY = centerY + Math.sin(angle - Math.PI / 2) * (armLength + 20);

    armsGroup.append('text')
      .attr('x', labelX)
      .attr('y', labelY)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '10px')
      .attr('fill', colorScale(affix.impactDelta))
      .attr('opacity', 0)
      .attr('class', 'affix-label')
      .attr('data-affix-id', affix.affixId.toString())
      .text(`${affix.affixName} ${affix.impactDelta > 0 ? '+' : ''}${affix.impactDelta.toFixed(1)}`);

    // Hover interaction
    const arm = armsGroup.select(`[data-affix-id="${affix.affixId}"]`);
    const label = armsGroup.select(`text[data-affix-id="${affix.affixId}"]`);

    arm.on('mouseenter', () => {
      label.transition().duration(200).attr('opacity', 1);
      arm.transition().duration(200).attr('opacity', 1);
    })
      .on('mouseleave', () => {
        label.transition().duration(200).attr('opacity', 0);
        arm.attr('opacity', 0.8);
      });
  });
}

// Helper to get color for an impact value
export function getAffixColor(impactDelta: number, maxImpact: number): string {
  const colorScale = d3.scaleLinear<string>()
    .domain([-maxImpact, 0, maxImpact])
    .range(['#10b981', '#999', '#ef4444']);
  return colorScale(impactDelta);
}
