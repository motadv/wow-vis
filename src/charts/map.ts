import * as d3 from 'd3';
import type { DungeonManifest, VolumeRow } from '../types';
import { ERA_PALETTE, MAP_WIDTH, MAP_HEIGHT, OFF_WORLD_X, OFF_WORLD_Y } from '../config';
import { getState, setState, subscribe } from '../state';

let nodesG: d3.Selection<SVGGElement, unknown, null, undefined>;
let manifest: DungeonManifest;
let volumeMap = new Map<number, VolumeRow>();
let rScale = d3.scaleSqrt().range([4, 32]);

let tooltipEl: HTMLDivElement;

export function initMap(container: HTMLElement, m: DungeonManifest): void {
  manifest = m;

  tooltipEl = document.createElement('div');
  Object.assign(tooltipEl.style, {
    position: 'absolute',
    pointerEvents: 'none',
    background: '#18181b',
    border: '1px solid #3f3f46',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '13px',
    color: '#e4e4e7',
    display: 'none',
  });
  (container.parentElement ?? document.body).appendChild(tooltipEl);

  const svg = d3.select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`)
    .style('display', 'block');

  const innerG = svg.append('g');

  innerG.append('image')
    .attr('href', '/map.webp')
    .attr('width', MAP_WIDTH)
    .attr('height', MAP_HEIGHT);

  innerG.append('text')
    .attr('x', OFF_WORLD_X)
    .attr('y', OFF_WORLD_Y - 40)
    .attr('text-anchor', 'middle')
    .attr('fill', '#71717a')
    .attr('font-size', 18)
    .text('Off-world');

  nodesG = innerG.append('g').attr('class', 'nodes');

  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.4, 5])
    .on('zoom', event => innerG.attr('transform', event.transform.toString()));

  svg.call(zoom);

  subscribe(renderNodes);
}

export function updateVolume(rows: VolumeRow[]): void {
  volumeMap = new Map(rows.map(r => [r.dungeon_id, r]));
  const counts = rows.map(r => r.entry_count);
  rScale.domain([0, d3.max(counts) ?? 1]);
  renderNodes();
}

function renderNodes(): void {
  if (!manifest) return;
  const { selectedDungeon, selectedSeason, filterEras } = getState();
  const activeDungeonIds = new Set(
    manifest.seasons.find(s => s.id === selectedSeason)?.dungeonIds ?? []
  );

  const node = nodesG
    .selectAll<SVGCircleElement, typeof manifest.dungeons[0]>('circle')
    .data(manifest.dungeons, d => d.id);

  const enter = node.enter()
    .append('circle')
    .attr('cx', d => d.offWorld ? offWorldX(d.id) : d.mapX)
    .attr('cy', d => d.offWorld ? offWorldY(d.id) : d.mapY)
    .attr('r', 0)
    .style('cursor', 'pointer')
    .on('mouseenter', function(_event, d) {
      const vol = volumeMap.get(d.id);
      tooltipEl.textContent = '';
      const strong = document.createElement('strong');
      strong.textContent = d.name;
      const stats = document.createTextNode(` · ${d.era} · max ${vol?.max_key ?? '—'} · n=${vol?.entry_count ?? 0}`);
      tooltipEl.appendChild(strong);
      tooltipEl.appendChild(stats);
      tooltipEl.style.display = 'block';
    })
    .on('mousemove', function(event) {
      const e = event as MouseEvent;
      tooltipEl.style.left = `${e.pageX + 14}px`;
      tooltipEl.style.top = `${e.pageY - 28}px`;
    })
    .on('mouseleave', function() {
      tooltipEl.style.display = 'none';
    })
    .on('click', (_event, d) => {
      setState({ selectedDungeon: d.id });
    });

  enter.merge(node)
    .transition().duration(300)
    .attr('r', d => {
      const vol = volumeMap.get(d.id);
      return vol ? rScale(vol.entry_count) : 4;
    })
    .attr('fill', d => ERA_PALETTE[d.era])
    .attr('stroke', d => d.id === selectedDungeon ? '#ffffff' : 'transparent')
    .attr('stroke-width', 2)
    .attr('opacity', d => {
      if (!activeDungeonIds.has(d.id)) return 0.12;
      if (filterEras.length > 0 && !filterEras.includes(d.era)) return 0.15;
      return 0.85;
    });

  node.exit().remove();
}

const offWorldIndex = new Map<number, number>();
function getOffWorldIndex(id: number): number {
  if (!offWorldIndex.has(id)) offWorldIndex.set(id, offWorldIndex.size);
  return offWorldIndex.get(id)!;
}
function offWorldX(id: number): number {
  return OFF_WORLD_X + (getOffWorldIndex(id) % 3) * 52 - 52;
}
function offWorldY(id: number): number {
  return OFF_WORLD_Y + Math.floor(getOffWorldIndex(id) / 3) * 52;
}
