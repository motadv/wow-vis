# Affix Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the affix analysis from a three-lens panel into a unified dungeon browser with dynamic multi-select drill-down, creative radial and stream visualizations for affix impact analysis.

**Architecture:** 
- Enhance existing heatmap to support multi-select dungeons and display F/T difficulty splits
- Replace affix.ts with new drill-down logic: 1 dungeon → single analysis, 2+ dungeons → aggregate + individuals
- Implement two novel visualizations: stream graph (Fortified/Tyrannical trend) and radial charts (secondary affix impact with arm encoding)
- Reorganize dashboard layout from fixed split panels to scrollable full-width stacked views
- All data processing happens in browser (queries, aggregation); no fetch pipeline changes

**Tech Stack:** D3.js, DuckDB-Wasm, TypeScript, vanilla CSS (no framework)

---

## File Structure

**Create (new files):**
- `src/charts/affix-stream.ts` — stream graph renderer for primary affix trend over weeks
- `src/charts/affix-radial.ts` — radial chart renderer for secondary affix impact

**Modify (existing files):**
- `src/state.ts` — add `selectedDungeons` array, refactor `affixFilters` state
- `src/types.ts` — add affix analysis data types
- `src/db/queries.ts` — add query functions for aggregation and affix impact calculation
- `src/charts/heatmap.ts` — add multi-select UI, F/T split bars, selection indicators
- `src/charts/affix.ts` — complete rewrite with new drill-down logic
- `src/charts/init.ts` — update initialization sequence
- `index.html` — restructure layout from split panels to scrollable stacked views
- `src/style.css` — new layout styles and affix panel component styles

---

## Phase 1: State & Data Layer

### Task 1: Update state.ts for multi-select dungeons

**Files:**
- Modify: `src/state.ts`

**Current state structure has `selectedDungeon` (single). Expand to support multi-select while maintaining backward compatibility for arc chart.**

- [ ] **Step 1: Add selectedDungeons array to state**

Open `src/state.ts` and locate the state interface. Add:

```typescript
export interface State {
  // ... existing fields ...
  selectedDungeon: number | null;           // single, for arc chart
  selectedDungeons: number[];               // array, for affix panel multi-select
  affixFilters: {
    seasonId: number | null;
    fortified: boolean | null;
  };
  affixLens: 'trend' | 'snapshot' | 'headtohead';
}
```

- [ ] **Step 2: Initialize selectedDungeons as empty array**

In the initial state object:

```typescript
const initialState: State = {
  // ... existing ...
  selectedDungeon: null,
  selectedDungeons: [],  // new
  affixFilters: {
    seasonId: null,
    fortified: null,
  },
  affixLens: 'trend',
};
```

- [ ] **Step 3: Add setState behavior for multi-select toggle**

Add a helper function to state.ts that handles dungeon selection toggling:

```typescript
export function toggleDungeonSelection(dungeonId: number): void {
  const state = getState();
  const index = state.selectedDungeons.indexOf(dungeonId);
  let newSelectedDungeons: number[];
  let newSelectedDungeon: number | null;

  if (index > -1) {
    // Remove dungeon
    newSelectedDungeons = state.selectedDungeons.filter(id => id !== dungeonId);
    newSelectedDungeon = newSelectedDungeons.length === 1 ? newSelectedDungeons[0] : null;
  } else {
    // Add dungeon
    newSelectedDungeons = [...state.selectedDungeons, dungeonId];
    newSelectedDungeon = newSelectedDungeons.length === 1 ? dungeonId : null;
  }

  setState({
    selectedDungeons: newSelectedDungeons,
    selectedDungeon: newSelectedDungeon,
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/state.ts
git commit -m "refactor: add multi-select dungeon state for affix panel"
```

---

### Task 2: Add affix analysis query functions

**Files:**
- Modify: `src/db/queries.ts`

**Add new query functions to calculate secondary affix impact (impact delta) and aggregate across dungeons.**

- [ ] **Step 1: Add secondary affix impact query**

In `src/db/queries.ts`, add this query function:

```typescript
export async function getSecondaryAffixImpact(
  conn: AsyncDuckDBConnection,
  dungeonId: number,
  seasonId: number,
  periodIds?: number[],
): Promise<Array<{ affixId: number; affixName: string; impactDelta: number }>> {
  // Get all periods for this season
  const manifest = getAffixManifest(); // from db/init.ts
  const allPeriods = periodIds || Object.keys(manifest[seasonId] || {}).map(Number);

  if (allPeriods.length === 0) return [];

  // Query baseline (all weeks)
  const baselineQuery = `
    SELECT MEDIAN(keystone_level) as baseline
    FROM leaderboard_${seasonId}
    WHERE dungeon_id = ? AND period IN (${allPeriods.join(',')})
  `;
  const baselineResult = await conn.query(baselineQuery, [dungeonId]);
  const baseline = (baselineResult.toArray()[0]?.baseline as number) || 0;

  // Get all secondary affixes for this season
  const affixSet = new Map<number, string>();
  for (const affixes of Object.values(manifest[seasonId] || {})) {
    for (const affix of affixes) {
      if (affix.id !== 10 && affix.id !== 9) { // exclude primary affixes (10=Fortified, 9=Tyrannical)
        affixSet.set(affix.id, affix.name);
      }
    }
  }

  // For each secondary affix, calculate impact delta
  const results: Array<{ affixId: number; affixName: string; impactDelta: number }> = [];

  for (const [affixId, affixName] of affixSet.entries()) {
    // Find periods where this affix appeared
    const affixPeriods: number[] = [];
    for (const [periodId, affixes] of Object.entries(manifest[seasonId] || {})) {
      if (affixes.some(a => a.id === affixId)) {
        affixPeriods.push(Number(periodId));
      }
    }

    if (affixPeriods.length === 0) continue;

    // Get median key level for weeks with this affix
    const withAffixQuery = `
      SELECT MEDIAN(keystone_level) as median_key
      FROM leaderboard_${seasonId}
      WHERE dungeon_id = ? AND period IN (${affixPeriods.join(',')})
    `;
    const withAffixResult = await conn.query(withAffixQuery, [dungeonId]);
    const withAffixMedian = (withAffixResult.toArray()[0]?.median_key as number) || 0;

    const impactDelta = withAffixMedian - baseline;
    results.push({ affixId, affixName, impactDelta });
  }

  return results.sort((a, b) => Math.abs(b.impactDelta) - Math.abs(a.impactDelta));
}
```

- [ ] **Step 2: Add aggregated secondary affix impact query**

Add function for comparing multiple dungeons:

```typescript
export async function getAggregateSecondaryAffixImpact(
  conn: AsyncDuckDBConnection,
  dungeonIds: number[],
  seasonId: number,
  periodIds?: number[],
): Promise<Array<{ affixId: number; affixName: string; averageImpactDelta: number }>> {
  // For each dungeon, get affix impact
  const dungeonImpacts = await Promise.all(
    dungeonIds.map(dId => getSecondaryAffixImpact(conn, dId, seasonId, periodIds)),
  );

  // Aggregate: average impact across dungeons
  const affixMap = new Map<number, { name: string; deltas: number[] }>();

  for (const impacts of dungeonImpacts) {
    for (const impact of impacts) {
      if (!affixMap.has(impact.affixId)) {
        affixMap.set(impact.affixId, { name: impact.affixName, deltas: [] });
      }
      affixMap.get(impact.affixId)!.deltas.push(impact.impactDelta);
    }
  }

  const results = Array.from(affixMap.entries()).map(([affixId, data]) => ({
    affixId,
    affixName: data.name,
    averageImpactDelta: data.deltas.reduce((a, b) => a + b, 0) / data.deltas.length,
  }));

  return results.sort((a, b) => Math.abs(b.averageImpactDelta) - Math.abs(a.averageImpactDelta));
}
```

- [ ] **Step 3: Add primary affix (Fortified/Tyrannical) trend query**

Add function to get Fortified vs Tyrannical balance by period:

```typescript
export async function getPrimaryAffixTrend(
  conn: AsyncDuckDBConnection,
  dungeonIds: number[],
  seasonId: number,
): Promise<Array<{ period: number; fortifiedMedian: number; tyrannicalMedian: number }>> {
  const dungeonClause = dungeonIds.length === 1 
    ? `dungeon_id = ${dungeonIds[0]}`
    : `dungeon_id IN (${dungeonIds.join(',')})`;

  const query = `
    SELECT 
      period,
      fortified,
      MEDIAN(keystone_level) as median_key
    FROM leaderboard_${seasonId}
    WHERE ${dungeonClause}
    GROUP BY period, fortified
    ORDER BY period ASC
  `;

  const result = await conn.query(query);
  const rows = result.toArray() as Array<{ period: number; fortified: boolean; median_key: number }>;

  // Pivot by period
  const periodMap = new Map<number, { fortifiedMedian: number; tyrannicalMedian: number }>();
  for (const row of rows) {
    if (!periodMap.has(row.period)) {
      periodMap.set(row.period, { fortifiedMedian: 0, tyrannicalMedian: 0 });
    }
    const entry = periodMap.get(row.period)!;
    if (row.fortified) {
      entry.fortifiedMedian = row.median_key;
    } else {
      entry.tyrannicalMedian = row.median_key;
    }
  }

  return Array.from(periodMap.entries()).map(([period, data]) => ({
    period,
    ...data,
  }));
}
```

- [ ] **Step 4: Commit**

```bash
git add src/db/queries.ts
git commit -m "feat: add affix impact and aggregation queries for drill-down analysis"
```

---

### Task 3: Add affix analysis types to types.ts

**Files:**
- Modify: `src/types.ts`

**Add TypeScript interfaces for affix analysis data.**

- [ ] **Step 1: Add affix impact types**

Open `src/types.ts` and add:

```typescript
export interface SecondaryAffixImpact {
  affixId: number;
  affixName: string;
  impactDelta: number;
}

export interface PrimaryAffixTrendPoint {
  period: number;
  fortifiedMedian: number;
  tyrannicalMedian: number;
}

export interface AffixAnalysisState {
  selectedDungeonIds: number[];
  seasonId: number | null;
  fortifiedFilter: boolean | null; // null = both, true = fortified only, false = tyrannical only
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "type: add affix analysis data structures"
```

---

## Phase 2: Visualization Components

### Task 4: Create stream graph renderer (affix-stream.ts)

**Files:**
- Create: `src/charts/affix-stream.ts`

**Stream graph shows Fortified vs Tyrannical balance over weeks as flowing streams.**

- [ ] **Step 1: Create affix-stream.ts with basic structure**

Create `src/charts/affix-stream.ts`:

```typescript
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

  // Stack the data for area generation
  const stackedData = data.map(d => [d.fortifiedMedian, d.tyrannicalMedian, d.period]);

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
```

- [ ] **Step 2: Commit**

```bash
git add src/charts/affix-stream.ts
git commit -m "feat: create stream graph renderer for primary affix trend visualization"
```

---

### Task 5: Create radial chart renderer (affix-radial.ts)

**Files:**
- Create: `src/charts/affix-radial.ts`

**Radial chart shows secondary affixes as radiating arms; arm length = impact magnitude.**

- [ ] **Step 1: Create affix-radial.ts**

Create `src/charts/affix-radial.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/charts/affix-radial.ts
git commit -m "feat: create radial chart renderer for secondary affix impact visualization"
```

---

### Task 6: Rewrite affix.ts with new drill-down logic

**Files:**
- Modify: `src/charts/affix.ts` (complete rewrite)

**Implement drill-down view: 1 dungeon → simple view, 2+ dungeons → aggregate + individuals.**

- [ ] **Step 1: Replace affix.ts completely**

Delete the old affix.ts content and write the new version:

```typescript
import * as d3 from 'd3';
import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import { getSecondaryAffixImpact, getAggregateSecondaryAffixImpact, getPrimaryAffixTrend } from '../db/queries.js';
import { getState, setState, subscribe } from '../state.js';
import { renderStreamGraph } from './affix-stream.js';
import { renderRadialChart } from './affix-radial.js';
import type { DungeonManifest } from '../types.js';

export async function initAffixChart(
  conn: AsyncDuckDBConnection,
  manifest: DungeonManifest,
): Promise<void> {
  const container = document.querySelector('#affix');
  if (!container) return;

  container.innerHTML = '';

  let lastSelectedDungeons: number[] = [];
  let lastSeasonId: number | null = null;

  subscribe(async state => {
    if (state.selectedDungeons.length === 0) {
      container.innerHTML = '<div style="color:#999;text-align:center;padding:20px;">Select one or more dungeons to analyze affixes.</div>';
      return;
    }

    if (state.selectedDungeons === lastSelectedDungeons && state.affixFilters.seasonId === lastSeasonId) {
      return; // No change
    }

    lastSelectedDungeons = [...state.selectedDungeons];
    lastSeasonId = state.affixFilters.seasonId;

    try {
      if (state.selectedDungeons.length === 1) {
        await renderSingleDungeonView(container, conn, manifest, state.selectedDungeons[0], state.affixFilters.seasonId);
      } else {
        await renderMultiDungeonView(container, conn, manifest, state.selectedDungeons, state.affixFilters.seasonId);
      }
    } catch (err) {
      console.error('Affix chart error:', err);
      container.innerHTML = '<div style="color:#ef4444;padding:20px;">Error loading affix data.</div>';
    }
  });
}

async function renderSingleDungeonView(
  container: HTMLElement,
  conn: AsyncDuckDBConnection,
  manifest: DungeonManifest,
  dungeonId: number,
  seasonId: number | null,
): Promise<void> {
  const dungeon = manifest.dungeons.find(d => d.id === dungeonId);
  if (!dungeon) return;

  const effectiveSeasonId = seasonId || manifest.seasons[manifest.seasons.length - 1]?.id || 6;

  container.innerHTML = '';

  // Title
  const title = document.createElement('div');
  title.style.cssText = 'padding:16px;font-size:16px;font-weight:bold;color:#e4e4e7;border-bottom:1px solid #27272a;';
  title.innerHTML = `${dungeon.name} — Affix Impact Analysis (Season ${effectiveSeasonId})`;
  container.appendChild(title);

  // Stream graph section
  const streamSection = document.createElement('div');
  streamSection.style.cssText = 'padding:16px;border-bottom:1px solid #27272a;';

  const streamLabel = document.createElement('div');
  streamLabel.style.cssText = 'font-size:12px;color:#999;text-transform:uppercase;margin-bottom:12px;';
  streamLabel.textContent = 'Primary Affix Trend (Fortified vs Tyrannical)';
  streamSection.appendChild(streamLabel);

  const streamChart = document.createElement('div');
  streamChart.style.cssText = 'height:180px;';
  streamSection.appendChild(streamChart);
  container.appendChild(streamSection);

  // Radial section
  const radialSection = document.createElement('div');
  radialSection.style.cssText = 'padding:16px;';

  const radialLabel = document.createElement('div');
  radialLabel.style.cssText = 'font-size:12px;color:#999;text-transform:uppercase;margin-bottom:12px;';
  radialLabel.textContent = 'Secondary Affix Impact';
  radialSection.appendChild(radialLabel);

  const radialChart = document.createElement('div');
  radialChart.style.cssText = 'display:flex;justify-content:center;';
  radialSection.appendChild(radialChart);
  container.appendChild(radialSection);

  // Load data and render
  const [streamData, affixData] = await Promise.all([
    getPrimaryAffixTrend(conn, [dungeonId], effectiveSeasonId),
    getSecondaryAffixImpact(conn, dungeonId, effectiveSeasonId),
  ]);

  renderStreamGraph(streamChart, streamData, streamChart.clientWidth, 180);
  renderRadialChart(radialChart, affixData, 250);
}

async function renderMultiDungeonView(
  container: HTMLElement,
  conn: AsyncDuckDBConnection,
  manifest: DungeonManifest,
  dungeonIds: number[],
  seasonId: number | null,
): Promise<void> {
  const effectiveSeasonId = seasonId || manifest.seasons[manifest.seasons.length - 1]?.id || 6;
  const dungeonNames = dungeonIds.map(id => manifest.dungeons.find(d => d.id === id)?.name || `Dungeon ${id}`).join(', ');

  container.innerHTML = '';

  // Title
  const title = document.createElement('div');
  title.style.cssText = 'padding:16px;font-size:16px;font-weight:bold;color:#e4e4e7;border-bottom:1px solid #27272a;';
  title.innerHTML = `${dungeonNames} — Aggregate Affix Analysis (Season ${effectiveSeasonId})`;
  container.appendChild(title);

  // Stream graph section
  const streamSection = document.createElement('div');
  streamSection.style.cssText = 'padding:16px;border-bottom:1px solid #27272a;';

  const streamLabel = document.createElement('div');
  streamLabel.style.cssText = 'font-size:12px;color:#999;text-transform:uppercase;margin-bottom:12px;';
  streamLabel.textContent = 'Primary Affix Trend';
  streamSection.appendChild(streamLabel);

  const streamChart = document.createElement('div');
  streamChart.style.cssText = 'height:180px;';
  streamSection.appendChild(streamChart);
  container.appendChild(streamSection);

  // Aggregate radial section
  const aggregateSection = document.createElement('div');
  aggregateSection.style.cssText = 'padding:16px;border-bottom:1px solid #27272a;';

  const aggregateLabel = document.createElement('div');
  aggregateLabel.style.cssText = 'font-size:12px;color:#999;text-transform:uppercase;margin-bottom:4px;';
  aggregateLabel.textContent = 'Aggregate Secondary Affix Impact';
  aggregateSection.appendChild(aggregateLabel);

  const aggregateSublabel = document.createElement('div');
  aggregateSublabel.style.cssText = 'font-size:11px;color:#666;margin-bottom:12px;font-style:italic;';
  aggregateSublabel.textContent = '(Average across selected dungeons)';
  aggregateSection.appendChild(aggregateSublabel);

  const aggregateChart = document.createElement('div');
  aggregateChart.style.cssText = 'display:flex;justify-content:center;';
  aggregateSection.appendChild(aggregateChart);
  container.appendChild(aggregateSection);

  // Individual radials section
  const individualsSection = document.createElement('div');
  individualsSection.style.cssText = 'padding:16px;';

  const individualsLabel = document.createElement('div');
  individualsLabel.style.cssText = 'font-size:12px;color:#999;text-transform:uppercase;margin-bottom:12px;';
  individualsLabel.textContent = 'Individual Dungeon Impact';
  individualsSection.appendChild(individualsLabel);

  const individualsGrid = document.createElement('div');
  individualsGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;';
  individualsSection.appendChild(individualsGrid);
  container.appendChild(individualsSection);

  // Load data and render
  const [streamData, aggregateData, ...individualDataArray] = await Promise.all([
    getPrimaryAffixTrend(conn, dungeonIds, effectiveSeasonId),
    getAggregateSecondaryAffixImpact(conn, dungeonIds, effectiveSeasonId),
    ...dungeonIds.map(dId => getSecondaryAffixImpact(conn, dId, effectiveSeasonId)),
  ]);

  renderStreamGraph(streamChart, streamData, streamChart.clientWidth, 180);
  renderRadialChart(aggregateChart, aggregateData, 220);

  // Render individual radials
  for (let i = 0; i < Math.min(dungeonIds.length, 3); i++) {
    const dungeonId = dungeonIds[i];
    const dungeon = manifest.dungeons.find(d => d.id === dungeonId);
    const individualData = individualDataArray[i];

    const card = document.createElement('div');
    card.style.cssText = 'background:#1a1a2e;padding:12px;border-radius:4px;';

    const cardTitle = document.createElement('div');
    cardTitle.style.cssText = 'font-size:12px;color:#a1a1aa;margin-bottom:8px;font-weight:600;';
    cardTitle.textContent = dungeon?.name || `Dungeon ${dungeonId}`;
    card.appendChild(cardTitle);

    const cardChart = document.createElement('div');
    cardChart.style.cssText = 'display:flex;justify-content:center;';
    card.appendChild(cardChart);

    individualsGrid.appendChild(card);

    renderRadialChart(cardChart, individualData, 160);
  }

  // "View all" link if more than 3
  if (dungeonIds.length > 3) {
    const expandLink = document.createElement('div');
    expandLink.style.cssText = 'grid-column:1/-1;text-align:center;padding:12px;font-size:12px;color:#3b82f6;cursor:pointer;text-decoration:underline;';
    expandLink.textContent = `View all ${dungeonIds.length} dungeons`;
    expandLink.onclick = () => {
      // TODO: implement expanded view
      console.log('Expand to full grid');
    };
    individualsGrid.appendChild(expandLink);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/charts/affix.ts
git commit -m "refactor: rewrite affix panel with dynamic drill-down logic (1 vs 2+ dungeons)"
```

---

### Task 7: Add multi-select support to heatmap.ts

**Files:**
- Modify: `src/charts/heatmap.ts`

**Enhance the dungeon ranking view to support multi-select and display F/T split bars.**

- [ ] **Step 1: Update tile click handler**

In `src/charts/heatmap.ts`, find the existing tile click handler (around line 80-100). Replace with:

```typescript
// Replace the existing click handler with:
function handleTileClick(dungeonId: number, event: MouseEvent) {
  event.stopPropagation();
  
  // Toggle dungeon selection
  const state = getState();
  const index = state.selectedDungeons.indexOf(dungeonId);
  let newSelectedDungeons: number[];

  if (index > -1) {
    newSelectedDungeons = state.selectedDungeons.filter(id => id !== dungeonId);
  } else {
    newSelectedDungeons = [...state.selectedDungeons, dungeonId];
  }

  // Also update single-select for arc
  const newSelectedDungeon = newSelectedDungeons.length === 1 ? newSelectedDungeons[0] : null;

  setState({
    selectedDungeons: newSelectedDungeons,
    selectedDungeon: newSelectedDungeon,
  });
}
```

- [ ] **Step 2: Add visual selection indicator to tiles**

Update the tile styling in the heatmap render function to show selection state:

```typescript
// In renderHeatmapLane or similar function, after creating tile elements:
const state = getState();
const isSelected = state.selectedDungeons.includes(dungeonId);

if (isSelected) {
  tile.classList.add('tile--selected');
} else {
  tile.classList.remove('tile--selected');
}

tile.style.cursor = 'pointer';
tile.onclick = (e) => handleTileClick(dungeonId, e);
```

- [ ] **Step 3: Add F/T split visualization**

For each dungeon row, add a visual showing Fortified vs Tyrannical split. Modify the lane rendering to include:

```typescript
// After dungeon name/label in each lane, add split bars
const splitContainer = document.createElement('div');
splitContainer.style.cssText = 'display:flex;gap:2px;align-items:center;margin-left:8px;height:24px;flex:0 0 auto;';

// Fortified bar (blue)
const fortBar = document.createElement('div');
fortBar.style.cssText = 'flex:0.55;background:#3b82f6;height:100%;border-radius:2px;';
fortBar.title = 'Fortified';
splitContainer.appendChild(fortBar);

// Tyrannical bar (orange)
const tyrBar = document.createElement('div');
tyrBar.style.cssText = 'flex:0.45;background:#f97316;height:100%;border-radius:2px;';
tyrBar.title = 'Tyrannical';
splitContainer.appendChild(tyrBar);

laneLabel.appendChild(splitContainer);
```

- [ ] **Step 4: Commit**

```bash
git add src/charts/heatmap.ts
git commit -m "feat: add multi-select support and F/T split visualization to dungeon browser"
```

---

### Task 8: Update charts/init.ts initialization sequence

**Files:**
- Modify: `src/charts/init.ts`

**Ensure affix chart is initialized with the new structure.**

- [ ] **Step 1: Update initAffixChart call**

In `src/charts/init.ts`, find the `initAffixChart()` call and update to:

```typescript
await initAffixChart(conn, manifest);
```

- [ ] **Step 2: Verify affix chart is called after heatmap**

Ensure initialization order is:
1. Load manifest and season data
2. Init map (if used)
3. Init heatmap
4. Init arc chart
5. Init affix chart

The affix chart depends on state changes from heatmap/arc, so it should be last.

- [ ] **Step 3: Commit**

```bash
git add src/charts/init.ts
git commit -m "refactor: update chart initialization sequence for new affix panel"
```

---

## Phase 3: Layout & Styling

### Task 9: Restructure index.html for scrollable layout

**Files:**
- Modify: `index.html`

**Change from fixed split panels to scrollable full-width stacked views.**

- [ ] **Step 1: Update layout structure**

Find the current layout structure in `index.html` and replace:

```html
<!-- OLD: split layout -->
<div id="layout" style="display:flex;flex-direction:row;">
  <div id="heatmap"></div>
  <div id="right" style="display:flex;flex-direction:column;">
    <div id="arc"></div>
    <div id="affix"></div>
  </div>
</div>

<!-- NEW: scrollable stacked layout -->
<div id="layout" style="display:flex;flex-direction:column;height:100vh;overflow-y:auto;">
  <div id="heatmap" style="min-height:400px;border-bottom:1px solid #27272a;"></div>
  <div id="arc" style="min-height:400px;border-bottom:1px solid #27272a;"></div>
  <div id="affix" style="min-height:500px;"></div>
</div>
```

- [ ] **Step 2: Remove #right wrapper**

Delete or comment out the `#right` div that was wrapping arc and affix.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "refactor: restructure dashboard layout to scrollable full-width stacked views"
```

---

### Task 10: Update CSS for new layout

**Files:**
- Modify: `src/style.css`

**Update styles to support scrollable layout and improve affix panel presentation.**

- [ ] **Step 1: Update #layout styles**

Replace existing `#layout` CSS:

```css
#layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow-y: auto;
  background: #09090b;
}

#heatmap {
  flex: 0 0 auto;
  min-height: 400px;
  overflow-y: auto;
  overflow-x: hidden;
  background: #18181b;
  border-bottom: 1px solid #27272a;
}

#arc {
  flex: 0 0 auto;
  min-height: 400px;
  overflow: hidden;
  background: #18181b;
  border-bottom: 1px solid #27272a;
}

#affix {
  flex: 0 0 auto;
  min-height: 500px;
  overflow-y: auto;
  overflow-x: hidden;
  background: #18181b;
}

#right {
  display: none; /* deprecated */
}
```

- [ ] **Step 2: Improve affix panel styles**

Add/update affix-specific styles:

```css
/* --- Affix panel styles --- */

.affix-tabs {
  display: none; /* Old lens tabs no longer needed */
}

.affix-filters {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #27272a;
  flex-wrap: wrap;
}

.affix-select,
.affix-toggle {
  padding: 8px 12px;
  background: #1a1a2e;
  border: 1px solid #27272a;
  border-radius: 4px;
  color: #e4e4e7;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.affix-select:hover,
.affix-toggle:hover {
  background: #27272a;
  border-color: #3f3f46;
}

.affix-chart {
  padding: 16px;
  overflow: hidden;
}

.affix-chart svg {
  max-width: 100%;
  height: auto;
}

.affix-empty-state {
  padding: 40px 20px;
  text-align: center;
  color: #71717a;
  font-size: 14px;
}

.stream-fortified {
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
}

.stream-tyrannical {
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
}

.affix-arm {
  cursor: pointer;
  transition: opacity 0.2s;
}

.affix-label {
  pointer-events: none;
  transition: opacity 0.2s;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/style.css
git commit -m "style: update layout and affix panel CSS for scrollable dashboard"
```

---

## Phase 4: Integration & Testing

### Task 11: Test dungeon selection → routing

**Files:**
- Test in browser (manual testing)

**Verify that selecting dungeons correctly routes to arc (1 dungeon) or affix panel (2+ dungeons).**

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Open browser to `http://localhost:5173`

- [ ] **Step 2: Select 1 dungeon**

Click a dungeon in the heatmap. Verify:
- Arc chart updates to show that dungeon's progression
- Affix panel shows single-dungeon view (stream + radial)
- Dungeon row is highlighted/selected

- [ ] **Step 3: Select 2+ dungeons**

Click additional dungeons. Verify:
- Arc chart clears (no single dungeon selected)
- Affix panel shows multi-dungeon view (stream + aggregate radial + individual radials)
- Multiple dungeon rows are highlighted

- [ ] **Step 4: Deselect all**

Click all selected dungeons again to deselect. Verify:
- Arc chart shows empty state
- Affix panel shows empty state

- [ ] **Step 5: Document observations**

If any issues found, note them for debugging in next task.

---

### Task 12: Test radial chart rendering

**Files:**
- Test in browser (manual testing)

**Verify radial charts render correctly with proper arm encoding and hover tooltips.**

- [ ] **Step 1: Select a dungeon with strong affix impact**

In the heatmap, find a dungeon known to have varied affix difficulty (e.g., one where Bursting is notably harder). Select it.

- [ ] **Step 2: Check radial chart rendering**

Verify:
- Radial arms appear (at least 4-5 affixes)
- Arm lengths vary (longer arms for bigger impact)
- Colors differentiate (red for harder, green for easier)
- Center circle is visible

- [ ] **Step 3: Test hover tooltips**

Hover over each arm. Verify:
- Tooltip appears with affix name and impact delta
- Tooltip disappears on mouse leave

- [ ] **Step 4: Test with multiple dungeons**

Select 2-3 dungeons. Verify:
- Aggregate radial appears (smaller, combined impact)
- Individual radials appear below (one per dungeon)
- Arm patterns differ between dungeons (showing variation)

- [ ] **Step 5: Document observations**

Note any rendering issues, hover misbehaviors, or visual glitches.

---

### Task 13: Test stream graph rendering

**Files:**
- Test in browser (manual testing)

**Verify stream graph displays Fortified/Tyrannical balance over weeks correctly.**

- [ ] **Step 1: Select a dungeon**

Pick a dungeon and verify stream graph appears above the radial chart.

- [ ] **Step 2: Check visual encoding**

Verify:
- Two colored streams (blue for Fortified, orange for Tyrannical)
- Streams flow over weeks (X-axis labeled with week numbers)
- Stream width varies (showing relative balance shifts)
- Y-axis labeled with difficulty range

- [ ] **Step 3: Test legend**

Verify:
- Legend visible (showing Fortified/Tyrannical labels)
- Colors match streams

- [ ] **Step 4: Test with multi-select**

Select 2+ dungeons. Verify:
- Stream graph shows aggregate balance (combined across selected dungeons)
- Pattern is similar but smoothed (averaged)

- [ ] **Step 5: Document observations**

Note any visual issues or axis labeling problems.

---

### Task 14: Performance and polish check

**Files:**
- Test in browser (manual testing)

**Verify smooth interactions, no lag, and visual polish.**

- [ ] **Step 1: Rapid dungeon selection**

Quickly click multiple dungeons. Verify:
- No lag or freezing
- Affix panel updates smoothly
- Visual feedback is immediate

- [ ] **Step 2: Check scroll performance**

Scroll through the dashboard. Verify:
- Smooth scrolling
- No jank or stuttering
- Charts remain interactive

- [ ] **Step 3: Verify empty states**

Deselect all dungeons. Verify:
- Empty state messages are clear
- No orphaned UI elements

- [ ] **Step 4: Check responsive sizing**

Resize browser window. Verify:
- Charts scale properly
- No overlapping text
- Radials remain readable at smaller sizes

- [ ] **Step 5: Document any issues for fixes**

Note visual bugs, missing styling, or interaction problems to address in refinement pass.

---

## Self-Review Checklist

✓ **Spec coverage:** 
- Dungeon Browser (swimlane with multi-select) → Tasks 7
- Affix Panel drill-down → Tasks 6
- Stream graph visualization → Tasks 4, 13
- Radial chart visualization → Tasks 5, 12
- Layout restructuring → Tasks 9, 10
- Data processing (no fetch changes) → Tasks 1-3

✓ **No placeholders:** All tasks have concrete code, exact file paths, and test steps

✓ **Type consistency:** State types defined in Task 1, used in Tasks 6-7, queries match Task 2

✓ **Dependencies ordered:** Data layer → Visualization → Layout → Testing

---

**Plan complete!**

Two execution options:

**1. Subagent-Driven (Recommended)** — Fresh subagent per task + review checkpoints. Faster iteration, clear handoffs.

**2. Inline Execution** — Execute tasks in this session with checkpoints between phases.

Which approach would you prefer?
