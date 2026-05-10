# Demo Branch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a screenshot-ready demo of the WoW Mythic+ dashboard on a `demo` branch, showing the world map with era-colored dungeon nodes, a two-season scrubber, and a detail panel (Era + Reintroduction views), all driven by hardcoded mock data — no DuckDB, no Parquet, no live API.

**Architecture:** `src/mock.ts` exports hardcoded `DungeonManifest`, per-season `VolumeRow[]`, and per-dungeon key distributions matching the existing types in `src/types.ts`. `initViz()` imports from mock and feeds the data directly into the chart modules. No async DB initialization. The chart modules themselves (`map.ts`, `scrubber.ts`, `detail/`) are real D3 implementations that will carry forward into the final app.

**Tech Stack:** Vite + TypeScript, D3.js v7, plain CSS. No unit tests — all verification is browser-based.

---

## File Map

| Path | Action | Responsibility |
|---|---|---|
| `src/config.ts` | Create | ERA_PALETTE, ERA_LABELS, ERAS_IN_ORDER, MAP_WIDTH/HEIGHT, OFF_WORLD_X/Y |
| `src/state.ts` | Create | getState, setState, subscribe pub/sub over AppState |
| `src/mock.ts` | Create | MOCK_MANIFEST, MOCK_VOLUME, MOCK_KEY_DIST hardcoded data |
| `src/charts/map.ts` | Create | initMap, updateVolume — D3 SVG world map with zoom + dungeon nodes |
| `src/charts/scrubber.ts` | Create | initScrubber — season pill buttons |
| `src/charts/detail/era.ts` | Create | renderEraView — horizontal bar chart by era |
| `src/charts/detail/reintroduction.ts` | Create | SeasonSnapshot type + renderReintroductionView — small multiples |
| `src/charts/detail/index.ts` | Create | initDetail, detail panel shell, delegates to era/reintroduction |
| `src/charts/init.ts` | Modify | initViz — wire all modules with mock data |

---

## Task 1: Config + State

**Files:**
- Create: `src/config.ts`
- Create: `src/state.ts`

- [ ] Create `src/config.ts`:

```ts
import type { Era } from './types';

export const MAP_WIDTH = 2048;
export const MAP_HEIGHT = 1400;
export const OFF_WORLD_X = 120;
export const OFF_WORLD_Y = 700;

export const ERA_PALETTE: Record<Era, string> = {
  vanilla:      '#C79C6E',
  tbc:          '#A9D271',
  wotlk:        '#69CCF0',
  cataclysm:    '#FF7D0A',
  mop:          '#00FF96',
  wod:          '#C4A35A',
  legion:       '#A335EE',
  bfa:          '#0070DD',
  shadowlands:  '#9482C9',
  dragonflight: '#E6A817',
  tww:          '#33C7A0',
  midnight:     '#5C4ADB',
};

export const ERA_LABELS: Record<Era, string> = {
  vanilla:      'Classic',
  tbc:          'TBC',
  wotlk:        'Wrath',
  cataclysm:    'Cataclysm',
  mop:          'Mists',
  wod:          'Warlords',
  legion:       'Legion',
  bfa:          'BfA',
  shadowlands:  'Shadowlands',
  dragonflight: 'Dragonflight',
  tww:          'The War Within',
  midnight:     'Midnight',
};

export const ERAS_IN_ORDER: Era[] = [
  'vanilla', 'tbc', 'wotlk', 'cataclysm', 'mop', 'wod',
  'legion', 'bfa', 'shadowlands', 'dragonflight', 'tww', 'midnight',
];
```

- [ ] Create `src/state.ts`:

```ts
import type { AppState, Era } from './types';

const state: AppState = {
  selectedSeason: -1,
  selectedDungeon: null,
  viewMode: 'era',
  filterEras: [] as Era[],
};

type Listener = (s: AppState) => void;
const listeners = new Set<Listener>();

export function getState(): AppState {
  return state;
}

export function setState(patch: Partial<AppState>): void {
  Object.assign(state, patch);
  listeners.forEach(fn => fn(state));
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
```

- [ ] Type-check: `npx tsc --noEmit`
  Expected: no errors

- [ ] Commit:
```bash
git add src/config.ts src/state.ts
git commit -m "✨ Add config constants and state pub/sub"
```

---

## Task 2: User Input Checkpoint — World Map PNG

> **STOP — user action required before continuing.**

- [ ] Ask the user to:
  1. Download a high-resolution Azeroth world map PNG from WoWpedia (search "Azeroth" on wowpedia.fandom.com, find the full continent map, download the highest-resolution version available).
  2. Place the file at `public/map.png`.
  3. Report the image dimensions (width × height in pixels) by running:
     ```bash
     file public/map.png
     ```

- [ ] Verify the image serves correctly: run `npm run dev`, then open `http://localhost:5173/map.png` in the browser — confirm the image loads.

- [ ] If the image is 2048×1400, proceed as-is. If different, scale the `mapX/mapY` coordinates in Task 3 proportionally:
  - `scaledX = originalX * (actualWidth / 2048)`
  - `scaledY = originalY * (actualHeight / 1400)`

---

## Task 3: Mock Data

**Files:**
- Create: `src/mock.ts`

Coordinates below assume a 2048×1400 Azeroth map (Eastern Kingdoms on the right half, Northrend at the top center). Adjust after seeing the map PNG.

- [ ] Create `src/mock.ts`:

```ts
import type { DungeonManifest, VolumeRow, KeyDistRow } from './types';

function makeDist(min: number, median: number, max: number, total: number): KeyDistRow[] {
  const rows: KeyDistRow[] = [];
  for (let k = min; k <= max; k++) {
    const d = Math.abs(k - median);
    rows.push({ keystone_level: k, count: Math.max(1, Math.round(total * Math.exp(-d * 0.45) / (max - min + 1))) });
  }
  return rows;
}

export const MOCK_MANIFEST: DungeonManifest = {
  dungeons: [
    { id: 101, name: 'Deadmines',                era: 'vanilla',      mapX: 1558, mapY: 843,  offWorld: false },
    { id: 102, name: 'Shadowfang Keep',           era: 'vanilla',      mapX: 1510, mapY: 632,  offWorld: false },
    { id: 103, name: 'The Nexus',                 era: 'wotlk',        mapX: 1128, mapY: 158,  offWorld: false },
    { id: 104, name: 'Halls of Stone',            era: 'wotlk',        mapX: 1297, mapY: 198,  offWorld: false },
    { id: 105, name: 'Blackrock Caverns',         era: 'cataclysm',    mapX: 1497, mapY: 897,  offWorld: false },
    { id: 106, name: 'Throne of the Tides',       era: 'cataclysm',    mapX: 1638, mapY: 910,  offWorld: false },
    { id: 107, name: 'Black Rook Hold',           era: 'legion',       mapX: 0,    mapY: 0,    offWorld: true  },
    { id: 108, name: 'Eye of Azshara',            era: 'legion',       mapX: 0,    mapY: 0,    offWorld: true  },
    { id: 109, name: 'Ruby Life Pools',           era: 'dragonflight', mapX: 0,    mapY: 0,    offWorld: true  },
    { id: 110, name: "Algeth'ar Academy",         era: 'dragonflight', mapX: 0,    mapY: 0,    offWorld: true  },
    { id: 111, name: 'Ara-Kara, City of Echoes',  era: 'tww',          mapX: 0,    mapY: 0,    offWorld: true  },
    { id: 112, name: 'City of Threads',           era: 'tww',          mapX: 0,    mapY: 0,    offWorld: true  },
  ],
  seasons: [
    {
      id: 1,
      name: 'Season 13 — Dragonflight',
      startTimestamp: 1_690_000_000,
      dungeonIds: [101, 102, 103, 104, 107, 108, 109, 110],
    },
    {
      id: 2,
      name: 'Season 1 — The War Within',
      startTimestamp: 1_720_000_000,
      dungeonIds: [103, 104, 105, 106, 107, 108, 111, 112],
    },
  ],
};

export const MOCK_VOLUME: Record<number, VolumeRow[]> = {
  1: [
    { dungeon_id: 101, entry_count: 312, min_key: 15, median_key: 22, max_key: 28 },
    { dungeon_id: 102, entry_count: 287, min_key: 14, median_key: 21, max_key: 27 },
    { dungeon_id: 103, entry_count: 445, min_key: 17, median_key: 24, max_key: 31 },
    { dungeon_id: 104, entry_count: 398, min_key: 16, median_key: 23, max_key: 30 },
    { dungeon_id: 107, entry_count: 521, min_key: 18, median_key: 25, max_key: 32 },
    { dungeon_id: 108, entry_count: 489, min_key: 17, median_key: 24, max_key: 31 },
    { dungeon_id: 109, entry_count: 476, min_key: 18, median_key: 25, max_key: 32 },
    { dungeon_id: 110, entry_count: 432, min_key: 16, median_key: 23, max_key: 30 },
  ],
  2: [
    { dungeon_id: 103, entry_count: 367, min_key: 16, median_key: 23, max_key: 29 },
    { dungeon_id: 104, entry_count: 341, min_key: 15, median_key: 22, max_key: 28 },
    { dungeon_id: 105, entry_count: 298, min_key: 14, median_key: 21, max_key: 27 },
    { dungeon_id: 106, entry_count: 312, min_key: 15, median_key: 21, max_key: 27 },
    { dungeon_id: 107, entry_count: 543, min_key: 19, median_key: 26, max_key: 33 },
    { dungeon_id: 108, entry_count: 501, min_key: 18, median_key: 25, max_key: 32 },
    { dungeon_id: 111, entry_count: 489, min_key: 18, median_key: 25, max_key: 32 },
    { dungeon_id: 112, entry_count: 512, min_key: 19, median_key: 26, max_key: 33 },
  ],
};

export const MOCK_KEY_DIST: Record<number, Record<number, KeyDistRow[]>> = {
  1: {
    101: makeDist(15, 22, 28, 312),
    102: makeDist(14, 21, 27, 287),
    103: makeDist(17, 24, 31, 445),
    104: makeDist(16, 23, 30, 398),
    107: makeDist(18, 25, 32, 521),
    108: makeDist(17, 24, 31, 489),
    109: makeDist(18, 25, 32, 476),
    110: makeDist(16, 23, 30, 432),
  },
  2: {
    103: makeDist(16, 23, 29, 367),
    104: makeDist(15, 22, 28, 341),
    105: makeDist(14, 21, 27, 298),
    106: makeDist(15, 21, 27, 312),
    107: makeDist(19, 26, 33, 543),
    108: makeDist(18, 25, 32, 501),
    111: makeDist(18, 25, 32, 489),
    112: makeDist(19, 26, 33, 512),
  },
};
```

- [ ] Type-check: `npx tsc --noEmit`
  Expected: no errors

- [ ] Commit:
```bash
git add src/mock.ts
git commit -m "✨ Add hardcoded mock data for demo"
```

---

## Task 4: World Map + Dungeon Nodes

**Files:**
- Create: `src/charts/map.ts`

- [ ] Create `src/charts/map.ts`:

```ts
import * as d3 from 'd3';
import type { DungeonManifest, VolumeRow } from '../types';
import { ERA_PALETTE, MAP_WIDTH, MAP_HEIGHT, OFF_WORLD_X, OFF_WORLD_Y } from '../config';
import { getState, subscribe } from '../state';

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
    .attr('href', '/map.png')
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
      const name = document.createTextNode(d.name);
      const stats = document.createTextNode(` · ${d.era} · max ${vol?.max_key ?? '—'} · n=${vol?.entry_count ?? 0}`);
      tooltipEl.textContent = '';
      const strong = document.createElement('strong');
      strong.appendChild(name);
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
      import('../state').then(({ setState }) => setState({ selectedDungeon: d.id }));
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
  return OFF_WORLD_X + (getOffWorldIndex(id) % 3) * 48 - 48;
}
function offWorldY(id: number): number {
  return OFF_WORLD_Y + Math.floor(getOffWorldIndex(id) / 3) * 48;
}
```

- [ ] Type-check: `npx tsc --noEmit`
  Expected: no errors

- [ ] Commit:
```bash
git add src/charts/map.ts
git commit -m "✨ Add D3 world map with dungeon nodes"
```

---

## Task 5: Season Scrubber

**Files:**
- Create: `src/charts/scrubber.ts`

- [ ] Create `src/charts/scrubber.ts`:

```ts
import type { SeasonMeta } from '../types';
import { getState, setState, subscribe } from '../state';

export function initScrubber(container: HTMLElement, seasons: SeasonMeta[]): void {
  const sorted = [...seasons].sort((a, b) => a.id - b.id);

  sorted.forEach(season => {
    const btn = document.createElement('button');
    btn.textContent = season.name;
    btn.dataset['seasonId'] = String(season.id);
    Object.assign(btn.style, {
      padding: '4px 14px',
      borderRadius: '9999px',
      border: '1px solid #3f3f46',
      background: 'transparent',
      color: '#a1a1aa',
      fontSize: '13px',
      cursor: 'pointer',
      transition: 'border-color 0.15s, color 0.15s',
    });
    btn.addEventListener('click', () => {
      setState({ selectedSeason: season.id, selectedDungeon: null });
    });
    container.appendChild(btn);
  });

  subscribe(({ selectedSeason }) => {
    container.querySelectorAll<HTMLButtonElement>('button').forEach(btn => {
      const active = Number(btn.dataset['seasonId']) === selectedSeason;
      btn.style.borderColor = active ? '#ffffff' : '#3f3f46';
      btn.style.color = active ? '#ffffff' : '#a1a1aa';
    });
  });

  // Reflect initial state
  const { selectedSeason } = getState();
  container.querySelectorAll<HTMLButtonElement>('button').forEach(btn => {
    const active = Number(btn.dataset['seasonId']) === selectedSeason;
    btn.style.borderColor = active ? '#ffffff' : '#3f3f46';
    btn.style.color = active ? '#ffffff' : '#a1a1aa';
  });
}
```

- [ ] Type-check: `npx tsc --noEmit`
  Expected: no errors

- [ ] Commit:
```bash
git add src/charts/scrubber.ts
git commit -m "✨ Add season scrubber pill buttons"
```

---

## Task 6: Detail Panel — Era View

**Files:**
- Create: `src/charts/detail/era.ts`

- [ ] Create directory if it doesn't exist:
```bash
mkdir -p src/charts/detail
```

- [ ] Create `src/charts/detail/era.ts`:

```ts
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
    const e = eraTotal.get(d.era) ?? { sum: 0, count: 0 };
    e.sum += row.entry_count;
    e.count += 1;
    eraTotal.set(d.era, e);
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
```

- [ ] Type-check: `npx tsc --noEmit`
  Expected: no errors

- [ ] Commit:
```bash
git add src/charts/detail/era.ts
git commit -m "✨ Add detail panel era view bar chart"
```

---

## Task 7: Detail Panel — Reintroduction View

**Files:**
- Create: `src/charts/detail/reintroduction.ts`

- [ ] Create `src/charts/detail/reintroduction.ts`:

```ts
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
```

- [ ] Type-check: `npx tsc --noEmit`
  Expected: no errors

- [ ] Commit:
```bash
git add src/charts/detail/reintroduction.ts
git commit -m "✨ Add detail panel reintroduction view small multiples"
```

---

## Task 8: Detail Panel Shell

**Files:**
- Create: `src/charts/detail/index.ts`

- [ ] Create `src/charts/detail/index.ts`:

```ts
import type { DungeonManifest, VolumeRow } from '../../types';
import { setState, subscribe } from '../../state';
import { ERA_PALETTE, ERA_LABELS } from '../../config';
import { renderEraView } from './era';
import { renderReintroductionView } from './reintroduction';
import type { SeasonSnapshot } from './reintroduction';
import { MOCK_KEY_DIST, MOCK_VOLUME } from '../../mock';

let allVolume: VolumeRow[] = [];

export function initDetail(container: HTMLElement, manifest: DungeonManifest): void {
  const detailEl = document.getElementById('detail')!;

  subscribe(state => {
    const { selectedDungeon, selectedSeason, viewMode } = state;
    if (selectedDungeon === null) {
      detailEl.classList.remove('open');
      return;
    }
    const dungeon = manifest.dungeons.find(d => d.id === selectedDungeon);
    if (!dungeon) return;
    detailEl.classList.add('open');

    while (container.firstChild) container.removeChild(container.firstChild);

    // Header
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      borderBottom: '1px solid #27272a',
      gap: '8px',
    });

    const nameWrap = document.createElement('div');
    Object.assign(nameWrap.style, { display: 'flex', alignItems: 'center', gap: '8px', minWidth: '0' });

    const dot = document.createElement('span');
    Object.assign(dot.style, {
      width: '10px', height: '10px', borderRadius: '50%',
      background: ERA_PALETTE[dungeon.era], flexShrink: '0', display: 'inline-block',
    });

    const nameEl = document.createElement('span');
    nameEl.textContent = dungeon.name;
    Object.assign(nameEl.style, { fontWeight: '600', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });

    const badge = document.createElement('span');
    badge.textContent = ERA_LABELS[dungeon.era];
    Object.assign(badge.style, {
      fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
      background: `${ERA_PALETTE[dungeon.era]}33`, color: ERA_PALETTE[dungeon.era], flexShrink: '0',
    });

    nameWrap.appendChild(dot);
    nameWrap.appendChild(nameEl);
    nameWrap.appendChild(badge);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    Object.assign(closeBtn.style, {
      background: 'transparent', border: 'none', color: '#71717a',
      fontSize: '16px', cursor: 'pointer', padding: '0 4px', flexShrink: '0',
    });
    closeBtn.addEventListener('click', () => setState({ selectedDungeon: null }));

    header.appendChild(nameWrap);
    header.appendChild(closeBtn);
    container.appendChild(header);

    // View toggle
    const toggle = document.createElement('div');
    Object.assign(toggle.style, { display: 'flex', gap: '4px', padding: '10px 16px', borderBottom: '1px solid #27272a' });

    (['era', 'reintroduction'] as const).forEach(mode => {
      const btn = document.createElement('button');
      btn.textContent = mode === 'era' ? 'Era View' : 'Reintroduction';
      Object.assign(btn.style, {
        flex: '1', padding: '4px 8px', borderRadius: '4px',
        border: '1px solid #3f3f46', fontSize: '12px', cursor: 'pointer',
        background: viewMode === mode ? '#27272a' : 'transparent',
        color: viewMode === mode ? '#e4e4e7' : '#71717a',
      });
      btn.addEventListener('click', () => setState({ viewMode: mode }));
      toggle.appendChild(btn);
    });

    container.appendChild(toggle);

    // Chart area
    const chartArea = document.createElement('div');
    chartArea.style.padding = '16px 0';
    container.appendChild(chartArea);

    const volRow = allVolume.find(r => r.dungeon_id === dungeon.id);

    if (viewMode === 'era') {
      renderEraView(chartArea, dungeon, volRow, allVolume, manifest);
    } else {
      renderReintroductionView(chartArea, dungeon, buildSnapshots(dungeon.id, manifest, selectedSeason));
    }
  });
}

export function setAllVolume(rows: VolumeRow[]): void {
  allVolume = rows;
}

function buildSnapshots(dungeonId: number, manifest: DungeonManifest, _selectedSeason: number): SeasonSnapshot[] {
  const seasons = manifest.seasons
    .filter(s => s.dungeonIds.includes(dungeonId))
    .sort((a, b) => a.id - b.id);

  const alwaysInPool = seasons.length === manifest.seasons.length;

  return seasons.map((season, idx) => {
    const dist = MOCK_KEY_DIST[season.id]?.[dungeonId] ?? [];
    const vol = MOCK_VOLUME[season.id]?.find(r => r.dungeon_id === dungeonId);
    return {
      seasonId: season.id,
      seasonName: season.name,
      isFirstAppearance: idx === 0,
      alwaysInPool,
      distribution: dist,
      maxKey: vol?.max_key ?? 0,
      entryCount: vol?.entry_count ?? 0,
    };
  });
}
```

- [ ] Type-check: `npx tsc --noEmit`
  Expected: no errors

- [ ] Commit:
```bash
git add src/charts/detail/index.ts
git commit -m "✨ Add detail panel shell with header and view toggle"
```

---

## Task 9: Wire initViz + Browser Integration

**Files:**
- Modify: `src/charts/init.ts`

- [ ] Replace the contents of `src/charts/init.ts` with:

```ts
import { MOCK_MANIFEST, MOCK_VOLUME } from '../mock';
import { setState, subscribe } from '../state';
import { initMap, updateVolume } from './map';
import { initScrubber } from './scrubber';
import { initDetail, setAllVolume } from './detail/index';

export default async function initViz(): Promise<void> {
  const manifest = MOCK_MANIFEST;
  const firstSeason = manifest.seasons[0];

  initMap(document.getElementById('map')!, manifest);
  initScrubber(document.getElementById('scrubber')!, manifest.seasons);
  initDetail(document.getElementById('detail')!, manifest);

  subscribe(({ selectedSeason }) => {
    const rows = MOCK_VOLUME[selectedSeason] ?? [];
    setAllVolume(rows);
    updateVolume(rows);
  });

  setState({ selectedSeason: firstSeason.id });
}
```

- [ ] Type-check: `npx tsc --noEmit`
  Expected: no errors

- [ ] Start dev server and verify in browser:
```bash
npm run dev
```
Open `http://localhost:5173` and confirm:
  - [ ] Azeroth map image renders as the background
  - [ ] Dungeon nodes appear, sized by volume, colored by era
  - [ ] Off-world cluster visible with "Off-world" label in the corner
  - [ ] Two season buttons appear in the bottom scrubber bar; Season 13 is highlighted by default
  - [ ] Clicking Season 1 (TWW) resizes/dims nodes — on-world Vanilla nodes fade, Cataclysm nodes appear
  - [ ] Hovering a node shows a tooltip with dungeon name, era, max key, and entry count
  - [ ] Clicking a node opens the right-hand detail panel
  - [ ] Era View bar chart renders with era-colored bars
  - [ ] Switching to Reintroduction view shows side-by-side mini bar charts (blue = first appearance, purple = reintroduction)
  - [ ] ✕ button closes the detail panel

- [ ] Take the following screenshots for the presentation:
  1. Season 13 active — full map with all Dragonflight-season nodes visible, no dungeon selected
  2. Season 1 (TWW) active — updated node sizes, Cataclysm nodes now visible
  3. Detail panel open on The Nexus (id 103, appears in both seasons) — Era View
  4. Same panel — Reintroduction View showing Season 13 (blue) and Season 1 TWW (purple) columns side by side

- [ ] Run `npm run build` to confirm no build errors:
```bash
npm run build
```
Expected: no errors

- [ ] Commit:
```bash
git add src/charts/init.ts
git commit -m "✨ Wire initViz with mock data for demo"
```
