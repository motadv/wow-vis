import * as d3 from 'd3';
import { MAP_WIDTH, MAP_HEIGHT, OFF_WORLD_X, OFF_WORLD_Y, ERA_PALETTE } from '../config.js';
import { getState, subscribe } from '../state.js';
import { setState } from '../state.js';
import type { DungeonManifest, DungeonMeta, VolumeRow } from '../types.js';

let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
let nodesG: d3.Selection<SVGGElement, unknown, null, undefined>;
let manifest: DungeonManifest;
let volumeMap = new Map<number, VolumeRow>();
let rScale = d3.scaleSqrt().range([4, 28]);

export function initMap(container: HTMLElement, mf: DungeonManifest): void {
  manifest = mf;

  svg = d3.select(container).append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('display', 'block');

  const root = svg.append('g').attr('class', 'zoom-root');

  root.append('image')
    .attr('href', '/map.jpg')
    .attr('width', MAP_WIDTH)
    .attr('height', MAP_HEIGHT)
    .attr('preserveAspectRatio', 'xMidYMid slice');

  root.append('text')
    .attr('x', OFF_WORLD_X)
    .attr('y', OFF_WORLD_Y - 16)
    .attr('text-anchor', 'middle')
    .attr('fill', '#a1a1aa')
    .attr('font-size', 13)
    .text('Off-world');

  nodesG = root.append('g').attr('class', 'nodes');

  svg.call(
    d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 5])
      .on('zoom', (event) => root.attr('transform', event.transform)),
  );

  subscribe(renderNodes);
}

export function updateVolume(rows: VolumeRow[]): void {
  volumeMap = new Map(rows.map(r => [r.dungeon_id, r]));
  const counts = rows.map(r => r.entry_count);
  if (counts.length > 0) {
    rScale.domain([0, d3.max(counts)!]);
  }
  renderNodes();
}

function dungeonX(d: DungeonMeta): number {
  return d.offWorld ? OFF_WORLD_X + (manifest.dungeons.filter(x => x.offWorld).indexOf(d) - 2) * 32 : d.mapX;
}

function dungeonY(d: DungeonMeta): number {
  return d.offWorld ? OFF_WORLD_Y : d.mapY;
}

function renderNodes(): void {
  if (!nodesG) return;
  const state = getState();
  const activeEras = new Set(state.filterEras);

  const nodes = nodesG.selectAll<SVGCircleElement, DungeonMeta>('circle')
    .data(manifest.dungeons, d => d.id);

  nodes.enter().append('circle')
    .attr('cx', dungeonX)
    .attr('cy', dungeonY)
    .attr('stroke-width', 2)
    .style('cursor', 'pointer')
    .on('click', (_event, d) => setState({ selectedDungeon: d.id }))
    .merge(nodes)
    .transition().duration(300)
    .attr('r', d => {
      const v = volumeMap.get(d.id);
      return v ? rScale(v.entry_count) : 5;
    })
    .attr('fill', d => ERA_PALETTE[d.era])
    .attr('stroke', d => d.id === state.selectedDungeon ? '#ffffff' : 'rgba(0,0,0,0.4)')
    .attr('opacity', d => {
      if (activeEras.size > 0 && !activeEras.has(d.era)) return 0.15;
      if (state.selectedDungeon !== null && d.id !== state.selectedDungeon) return 0.5;
      return 1;
    });

  nodes.exit().remove();
}
