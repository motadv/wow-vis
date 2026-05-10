# Detail Panel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the detail panel a floating overlay that doesn't shift the map, and improve both charts with proper axes and a cleaner layout.

**Architecture:** `#middle` becomes `position:relative`; `#detail` becomes `position:absolute` overlapping the map's right side, animated via CSS `transform`. Both D3 chart functions are rewritten in-place — no new files, no interface changes.

**Tech Stack:** D3 v7, TypeScript (strict), Vite dev server on port 5173.

---

## File Map

| File | Change |
|---|---|
| `src/style.css` | `#middle` → relative; `#detail` → absolute + transform transition |
| `src/charts/detail/index.ts` | No change (classList toggle already works) |
| `src/charts/detail/era.ts` | Add gridlines, x-axis with label, bump overlay opacity |
| `src/charts/detail/reintroduction.ts` | Vertical stack, per-panel x-axis + gridlines |
| `.gitignore` | Add `.superpowers/` |

---

> **Note on testing:** These tasks are pure CSS and D3 rendering — no pure logic to unit test. Verification is: `npm run build` (TypeScript check passes) followed by manual inspection in the browser at `http://localhost:5173`.

---

## Task 0: Housekeeping

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add `.superpowers/` to `.gitignore`**

Open `.gitignore` and append one line at the end:

```
.superpowers/
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "🙈 Ignore .superpowers brainstorm artifacts"
```

---

## Task 1: Floating panel — CSS

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: Replace `#middle` and `#detail` rules**

Replace the current `#middle` block:

```css
#middle {
  display: flex;
  flex: 1;
  overflow: hidden;
}
```

with:

```css
#middle {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}
```

Replace the current `#detail` block and `#detail.open` block:

```css
#detail {
  display: none;
  width: 384px;
  flex-shrink: 0;
  overflow-y: auto;
  background: #18181b;
  border-left: 1px solid #27272a;
}

#detail.open {
  display: block;
}
```

with:

```css
#detail {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 384px;
  overflow-y: auto;
  background: #18181b;
  border-left: 1px solid #27272a;
  transform: translateX(100%);
  transition: transform 0.25s ease;
  pointer-events: none;
  z-index: 10;
}

#detail.open {
  transform: translateX(0);
  pointer-events: auto;
}
```

- [ ] **Step 2: Verify TypeScript still passes**

```bash
npm run build
```

Expected: no errors. The build should complete cleanly — this task touches only CSS.

- [ ] **Step 3: Verify in browser**

Open `http://localhost:5173`. Click any dungeon node on the map. The detail panel should slide in from the right without the map shrinking. Click ✕ — the panel should slide back out, leaving the map untouched.

- [ ] **Step 4: Commit**

```bash
git add src/style.css
git commit -m "✨ Float detail panel as absolute overlay with slide transition"
```

---

## Task 2: Era chart — x-axis, gridlines, overlay opacity

**Files:**
- Modify: `src/charts/detail/era.ts`

- [ ] **Step 1: Replace `era.ts` with the improved version**

Overwrite `src/charts/detail/era.ts` entirely:

```typescript
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
    const acc = eraTotal.get(d.era) ?? { sum: 0, count: 0 };
    acc.sum += row.entry_count;
    acc.count += 1;
    eraTotal.set(d.era, acc);
  }

  const bars: EraBar[] = ERAS_IN_ORDER
    .filter(e => eraTotal.has(e))
    .map(e => ({ era: e, avg: eraTotal.get(e)!.sum / eraTotal.get(e)!.count }))
    .sort((a, b) => b.avg - a.avg);

  const width = container.clientWidth || 352;
  const barH = 24;
  const gap = 6;
  const labelW = 104;
  const margin = { top: 8, right: 56, bottom: 32, left: labelW };
  const innerW = width - margin.left - margin.right;
  const barsH = bars.length * (barH + gap) - gap;
  const height = barsH + margin.top + margin.bottom;

  const xScale = d3.scaleLinear()
    .domain([0, d3.max(bars, d => d.avg) ?? 1])
    .range([0, innerW]);

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // Vertical gridlines behind bars
  const tickVals = xScale.ticks(4);
  g.selectAll<SVGLineElement, number>('line.grid')
    .data(tickVals)
    .enter()
    .append('line')
    .attr('class', 'grid')
    .attr('x1', d => xScale(d))
    .attr('x2', d => xScale(d))
    .attr('y1', 0)
    .attr('y2', barsH)
    .attr('stroke', '#27272a')
    .attr('stroke-width', 0.5);

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

  // Selected dungeon's own value overlay
  if (thisVolume) {
    const thisBar = bars.find(b => b.era === dungeon.era);
    if (thisBar) {
      g.append('rect')
        .attr('transform', `translate(0,${bars.indexOf(thisBar) * (barH + gap)})`)
        .attr('width', xScale(thisVolume.entry_count))
        .attr('height', barH)
        .attr('rx', 3)
        .attr('fill', '#ffffff')
        .attr('opacity', 0.28);
    }
  }

  // X-axis
  const xAxis = d3.axisBottom(xScale)
    .ticks(4)
    .tickFormat(d => d3.format('~s')(d as number));

  const axisG = g.append('g')
    .attr('transform', `translate(0,${barsH})`)
    .call(xAxis);

  axisG.select('.domain').attr('stroke', '#3f3f46');
  axisG.selectAll('.tick line').attr('stroke', '#3f3f46');
  axisG.selectAll<SVGTextElement, unknown>('.tick text')
    .attr('fill', '#52525b')
    .attr('font-size', 10);

  // Axis label
  g.append('text')
    .attr('x', innerW / 2)
    .attr('y', barsH + 28)
    .attr('text-anchor', 'middle')
    .attr('fill', '#52525b')
    .attr('font-size', 10)
    .text('Avg completions');
}
```

- [ ] **Step 2: Verify TypeScript passes**

```bash
npm run build
```

Expected: no errors, no unused variable warnings.

- [ ] **Step 3: Verify in browser**

Open `http://localhost:5173`. Click a dungeon and select **Era View**. You should see:
- Vertical gridlines at each tick behind the bars
- An x-axis line with tick marks at the bottom
- "Avg completions" label below the axis
- The selected dungeon's white overlay is visibly brighter than before

- [ ] **Step 4: Commit**

```bash
git add src/charts/detail/era.ts
git commit -m "✨ Add x-axis and gridlines to era chart"
```

---

## Task 3: Reintroduction chart — vertical stack with axes

**Files:**
- Modify: `src/charts/detail/reintroduction.ts`

- [ ] **Step 1: Replace `reintroduction.ts` with the improved version**

Overwrite `src/charts/detail/reintroduction.ts` entirely:

```typescript
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

  const panelW = (container.clientWidth || 352) - 32;
  const chartH = 90;
  const margin = { top: 4, right: 4, bottom: 28, left: 4 };
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
    Object.assign(typeLabel.style, { fontSize: '11px', fontWeight: '600', color });
    typeLabel.textContent = snap.isFirstAppearance ? 'First Appearance' : 'Reintroduction';

    const statsLabel = document.createElement('span');
    Object.assign(statsLabel.style, { fontSize: '10px', color: '#71717a' });
    statsLabel.textContent = `max ${snap.maxKey} · n=${snap.entryCount}`;

    headerRow.appendChild(typeLabel);
    headerRow.appendChild(statsLabel);
    cell.appendChild(headerRow);

    // Season name subline
    const seasonSpan = document.createElement('span');
    Object.assign(seasonSpan.style, { fontSize: '10px', color: '#71717a' });
    seasonSpan.textContent = snap.seasonName;
    cell.appendChild(seasonSpan);

    // SVG histogram
    const xScale = d3.scaleLinear().domain(xDomain).range([0, innerW]);
    const yMax = d3.max(snap.distribution, r => r.count) ?? 1;
    const yScale = d3.scaleLinear().domain([0, yMax]).range([innerH, 0]);
    const barW = Math.max(2, innerW / Math.max(1, snap.distribution.length) - 1);

    const svg = d3.select(cell)
      .append('svg')
      .attr('width', panelW)
      .attr('height', chartH);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Horizontal gridlines at 25%, 50%, 75% of innerH (drawn behind bars)
    [0.25, 0.5, 0.75].forEach(frac => {
      g.append('line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', innerH * (1 - frac)).attr('y2', innerH * (1 - frac))
        .attr('stroke', '#27272a')
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
      .attr('font-size', 9);

    // Axis label
    g.append('text')
      .attr('x', innerW / 2)
      .attr('y', innerH + 24)
      .attr('text-anchor', 'middle')
      .attr('fill', '#52525b')
      .attr('font-size', 10)
      .text('Key level');

    wrap.appendChild(cell);
  }
}
```

- [ ] **Step 2: Verify TypeScript passes**

```bash
npm run build
```

Expected: no errors, no unused variable warnings.

- [ ] **Step 3: Verify in browser**

Open `http://localhost:5173`. Click a dungeon that appears in multiple seasons (e.g. Deadmines in the mock data) and select **Reintroduction**. You should see:
- One histogram panel per season, stacked vertically
- Each panel has a colored "First Appearance" or "Reintroduction" label top-left and `max N · n=M` top-right
- Season name below the label
- Histogram bars with faint horizontal gridlines behind them
- X-axis ticks showing key levels, "Key level" label below
- All panels share the same x-axis domain so distributions are visually comparable

- [ ] **Step 4: Commit**

```bash
git add src/charts/detail/reintroduction.ts
git commit -m "✨ Reintroduction view: vertical stack with x-axis and gridlines"
```
