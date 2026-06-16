import * as d3 from 'd3';

const PALETTE = d3.schemeTableau10 as readonly string[];

export function dungeonColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}
