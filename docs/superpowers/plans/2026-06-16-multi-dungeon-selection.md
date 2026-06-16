# Multi-Dungeon Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken dual-field selection model with a single `selectedDungeons` array, then implement multi-dungeon rendering in the arc chart (per-dungeon colors, thin seasonal lines, thick average line) and affix panel (stacked per-dungeon matrices).

**Architecture:** Remove `selectedDungeon` from `AppState`; all consumers branch on `selectedDungeons.length`. A shared `dungeonColor(index)` utility ensures color consistency across panels. Arc and affix each handle single vs. multi rendering internally.

**Tech Stack:** TypeScript, D3.js, DuckDB-Wasm, Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/utils/colors.ts` | **Create** | `dungeonColor(index)` — shared tableau10 color by index |
| `src/utils/colors.test.ts` | **Create** | Tests for `dungeonColor` |
| `src/utils/arc-utils.ts` | **Create** | `computeAverageArc` — pure average-across-seasons fn |
| `src/utils/arc-utils.test.ts` | **Create** | Tests for `computeAverageArc` |
| `src/types.ts` | **Modify** | Make `selectedDungeon` optional (transition), then remove it |
| `src/state.ts` | **Modify** | Add `selectOnlyDungeon`, add cap-of-4, remove `selectedDungeon` refs |
| `src/charts/map.ts` | **Modify** | Use `selectOnlyDungeon`; read `selectedDungeons` for visual feedback |
| `src/style.css` | **Modify** | Yellow selected, white hover, faded non-selected tiles |
| `src/charts/dungeon-browser.ts` | **Modify** | Apply new tile classes; add `N/4 selected` counter |
| `src/charts/arc.ts` | **Modify** | Single mode: use `selectedDungeons[0]`; multi mode: new renderer |
| `src/charts/affix.ts` | **Modify** | Multi mode: stacked per-dungeon matrices |

---

## Task 1: Shared color utility

**Files:**
- Create: `src/utils/colors.ts`
- Create: `src/utils/colors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/colors.test.ts
import { describe, it, expect } from 'vitest';
import { dungeonColor } from './colors.js';

describe('dungeonColor', () => {
  it('returns a non-empty hex string for index 0', () => {
    expect(dungeonColor(0)).toMatch(/^#[0-9a-f]{6}$/i);
  });
  it('wraps around at 10', () => {
    expect(dungeonColor(10)).toBe(dungeonColor(0));
    expect(dungeonColor(11)).toBe(dungeonColor(1));
  });
  it('returns different colors for indices 0-9', () => {
    const colors = Array.from({ length: 10 }, (_, i) => dungeonColor(i));
    const unique = new Set(colors);
    expect(unique.size).toBe(10);
  });
});
```

- [ ] **Step 2: Run test — expect it to fail**

```bash
npm run test -- colors
```

Expected: `Cannot find module './colors.js'`

- [ ] **Step 3: Create the implementation**

```ts
// src/utils/colors.ts
import * as d3 from 'd3';

const PALETTE = d3.schemeTableau10 as readonly string[];

export function dungeonColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}
```

- [ ] **Step 4: Run test — expect it to pass**

```bash
npm run test -- colors
```

Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/colors.ts src/utils/colors.test.ts
git commit -m "✨ Add dungeonColor shared utility"
```

---

## Task 2: CSS tile highlight redesign

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: Replace `.tile--highlighted` and `.tile--selected` rules**

Current rules (lines 145–153 in `src/style.css`):
```css
.tile--highlighted {
  outline: 2px solid #fbbf24;
  outline-offset: 1px;
}

.tile--selected {
  outline: 2px solid #818cf8;
  outline-offset: 1px;
}
```

Replace with:
```css
.tile--highlighted {
  background: #ffffff !important;
  color: #18181b !important;
}

.tile--selected {
  background: #eab308 !important;
  color: #18181b !important;
}

.tile--faded {
  opacity: 0.6;
}
```

- [ ] **Step 2: Build and verify no errors**

```bash
npm run build
```

Expected: exits 0 (CSS change only, no TS errors).

- [ ] **Step 3: Commit**

```bash
git add src/style.css
git commit -m "🎨 Update tile highlight: yellow selected, white hover, faded unselected"
```

---

## Task 3: State foundations — `selectOnlyDungeon` + cap-of-4

**Files:**
- Modify: `src/types.ts`
- Modify: `src/state.ts`

- [ ] **Step 1: Make `selectedDungeon` optional in `AppState`**

In `src/types.ts`, change line 102:
```ts
// Before:
selectedDungeon: number | null;

// After:
selectedDungeon?: number | null;
```

This lets us remove it from the initial state without TypeScript requiring every `setState` call to provide it.

- [ ] **Step 2: Update `state.ts` — remove `selectedDungeon` from initial state, rewrite `toggleDungeonSelection`, add `selectOnlyDungeon`**

Replace the entire contents of `src/state.ts` with:

```ts
import type { AppState } from './types.js';

let state: AppState = {
  selectedDungeons: [],
  selectedSeasonForArc: null,
  affixLens: 'trend',
  affixFilters: {
    dungeonId: null,
    seasonId: null,
    fortified: null,
    secondaryAffixId: null,
  },
};

type Listener = (state: AppState) => void;
const listeners = new Set<Listener>();

export function getState(): AppState {
  return state;
}

export function setState(patch: Partial<AppState>): void {
  state = { ...state, ...patch };
  for (const fn of listeners) fn(state);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function toggleDungeonSelection(dungeonId: number): void {
  const current = getState();
  const index = current.selectedDungeons.indexOf(dungeonId);

  let newSelectedDungeons: number[];
  if (index > -1) {
    newSelectedDungeons = current.selectedDungeons.filter(id => id !== dungeonId);
  } else {
    if (current.selectedDungeons.length >= 4) return;
    newSelectedDungeons = [...current.selectedDungeons, dungeonId];
  }

  setState({ selectedDungeons: newSelectedDungeons });
}

export function selectOnlyDungeon(dungeonId: number): void {
  setState({
    selectedDungeons: [dungeonId],
    selectedSeasonForArc: null,
  });
}
```

- [ ] **Step 3: Build — expect TypeScript errors only in `arc.ts` and `map.ts` (they still reference `state.selectedDungeon`)**

```bash
npm run build 2>&1 | grep "selectedDungeon"
```

Expected: errors in `src/charts/arc.ts` and `src/charts/map.ts` only. That's expected — they'll be fixed in Tasks 4 and 5.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/state.ts
git commit -m "♻️ Refactor state: add selectOnlyDungeon, cap selection at 4"
```

---

## Task 4: Fix `map.ts` to use `selectOnlyDungeon` and `selectedDungeons`

**Files:**
- Modify: `src/charts/map.ts`

- [ ] **Step 1: Update the import in `map.ts`**

In `src/charts/map.ts` line 10, add `selectOnlyDungeon` to the import:
```ts
import { getState, subscribe, selectOnlyDungeon } from '../state.js';
```

Remove `setState` from the import (it's no longer used in map.ts).

- [ ] **Step 2: Fix the click handler (line 124)**

```ts
// Before:
.on("click", (_event, d) => setState({ selectedDungeon: d.id, selectedSeasonForArc: null }))

// After:
.on("click", (_event, d) => selectOnlyDungeon(d.id))
```

- [ ] **Step 3: Fix the stroke color accessor (line 130)**

```ts
// Before:
d.id === state.selectedDungeon ? "#ffffff" : "rgba(0,0,0,0.4)"

// After:
state.selectedDungeons.includes(d.id) ? "#ffffff" : "rgba(0,0,0,0.4)"
```

- [ ] **Step 4: Fix the opacity accessor (line 133)**

```ts
// Before:
state.selectedDungeon !== null && d.id !== state.selectedDungeon ? 0.5 : 1

// After:
state.selectedDungeons.length > 0 && !state.selectedDungeons.includes(d.id) ? 0.5 : 1
```

- [ ] **Step 5: Build — only `arc.ts` should still error**

```bash
npm run build 2>&1 | grep "selectedDungeon"
```

Expected: errors only in `src/charts/arc.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/charts/map.ts
git commit -m "♻️ Map: use selectOnlyDungeon and selectedDungeons array"
```

---

## Task 5: Fix `arc.ts` single mode — drop `selectedDungeon`, use `selectedDungeons[0]`

**Files:**
- Modify: `src/charts/arc.ts`

- [ ] **Step 1: Replace the cache variable declarations inside `initArc`**

Inside `initArc`, replace:
```ts
let lastDungeonId: number | null = null;
let lastArcData: ArcEntry[] = [];
```

With:
```ts
let lastSelectionKey = '';
let lastSingleData: ArcEntry[] = [];
```

- [ ] **Step 2: Replace the subscribe callback in `initArc`**

Replace the entire `subscribe(async (state) => { ... });` block with:

```ts
subscribe(async (state) => {
  if (state.selectedDungeons.length === 0) {
    lastSelectionKey = '';
    lastSingleData = [];
    container.replaceChildren(emptyMsg);
    return;
  }

  if (state.selectedDungeons.length > 1) {
    // multi mode — handled in a later task; skip for now
    return;
  }

  // single mode
  const dungeonId = state.selectedDungeons[0];
  const selectionKey = String(dungeonId);

  if (selectionKey !== lastSelectionKey) {
    const activeSeasonsForDungeon = manifest.seasons
      .filter(s => s.dungeonIds.includes(dungeonId) && s.id <= MAX_SEASON)
      .sort((a, b) => a.id - b.id);

    lastSingleData = await Promise.all(
      activeSeasonsForDungeon.map(async (s, i) => {
        await loadSeason(s.id);
        const [rows, affixImpacts] = await Promise.all([
          getWeeklyArc(conn, dungeonId, s.id),
          getSecondaryAffixImpact(conn, dungeonId, s.id),
        ]);
        const secondaryAffixImpact = new Map(
          affixImpacts.map(a => [a.affixId, a.impactDelta]),
        );
        return { season: s, rows, colorIndex: i, secondaryAffixImpact };
      }),
    );

    if (getState().selectedDungeons[0] !== dungeonId) return;
    lastSelectionKey = selectionKey;
  }

  const dungeon = manifest.dungeons.find(d => d.id === dungeonId);
  if (!dungeon) return;

  renderArc(container, dungeon.name, lastSingleData, state.selectedSeasonForArc);
});
```

- [ ] **Step 3: Remove `selectedDungeon` from `types.ts` entirely**

In `src/types.ts`, delete the line:
```ts
selectedDungeon?: number | null;
```

- [ ] **Step 4: Build — expect zero errors**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 5: Run tests**

```bash
npm run test
```

Expected: all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/charts/arc.ts src/types.ts
git commit -m "♻️ Arc: drop selectedDungeon, use selectedDungeons[0] for single mode"
```

---

## Task 6: Dungeon browser — tile highlights and selection counter

**Files:**
- Modify: `src/charts/dungeon-browser.ts`

- [ ] **Step 1: Store a reference to `subtitleEl`**

In `initDungeonBrowser`, the `subtitleEl` is already created and assigned to a `const`. Ensure it remains accessible from the `subscribe` callback below (it's declared in the same scope, so this is fine — just verify it's not inside a nested block).

- [ ] **Step 2: Update the `subscribe` handler at the bottom of `initDungeonBrowser`**

Replace:
```ts
subscribe((state) => {
  container.querySelectorAll<HTMLElement>('.tile').forEach((tile) => {
    const dungeonId = Number(tile.dataset.dungeonId);
    const isSelected = state.selectedDungeons.includes(dungeonId);
    tile.classList.toggle('tile--selected', isSelected);
  });
});
```

With:
```ts
subscribe((state) => {
  const hasSelection = state.selectedDungeons.length > 0;

  subtitleEl.textContent = hasSelection
    ? `${state.selectedDungeons.length} / 4 selected · Left tile = highest median key level`
    : 'Oldest season at top · Left tile = highest median key level';

  container.querySelectorAll<HTMLElement>('.tile').forEach((tile) => {
    const dungeonId = Number(tile.dataset.dungeonId);
    const isSelected = state.selectedDungeons.includes(dungeonId);
    tile.classList.toggle('tile--selected', isSelected);
    tile.classList.toggle('tile--faded', hasSelection && !isSelected);
  });
});
```

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/charts/dungeon-browser.ts
git commit -m "🎨 Dungeon browser: yellow/white tile highlights and N/4 counter"
```

---

## Task 7: Extract and test `computeAverageArc`

**Files:**
- Create: `src/utils/arc-utils.ts`
- Create: `src/utils/arc-utils.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/arc-utils.test.ts
import { describe, it, expect } from 'vitest';
import { computeAverageArc } from './arc-utils.js';
import type { WeeklyArcRow } from '../types.js';

describe('computeAverageArc', () => {
  it('returns empty array for empty input', () => {
    expect(computeAverageArc([])).toEqual([]);
  });

  it('returns same rows when only one season', () => {
    const rows: WeeklyArcRow[] = [
      { period_index: 1, period: 100, median_key: 10 },
      { period_index: 2, period: 101, median_key: 12 },
    ];
    const result = computeAverageArc([rows]);
    expect(result).toEqual([
      { period_index: 1, median_key: 10 },
      { period_index: 2, median_key: 12 },
    ]);
  });

  it('averages median_key across seasons at the same period_index', () => {
    const season1: WeeklyArcRow[] = [{ period_index: 1, period: 100, median_key: 10 }];
    const season2: WeeklyArcRow[] = [{ period_index: 1, period: 200, median_key: 20 }];
    const result = computeAverageArc([season1, season2]);
    expect(result).toEqual([{ period_index: 1, median_key: 15 }]);
  });

  it('handles seasons with different lengths — shorter seasons have no data for later weeks', () => {
    const season1: WeeklyArcRow[] = [
      { period_index: 1, period: 100, median_key: 10 },
      { period_index: 2, period: 101, median_key: 20 },
    ];
    const season2: WeeklyArcRow[] = [
      { period_index: 1, period: 200, median_key: 30 },
    ];
    const result = computeAverageArc([season1, season2]);
    expect(result).toEqual([
      { period_index: 1, median_key: 20 }, // avg of 10 and 30
      { period_index: 2, median_key: 20 }, // only season1 has week 2
    ]);
  });

  it('returns results sorted by period_index ascending', () => {
    const rows: WeeklyArcRow[] = [
      { period_index: 3, period: 103, median_key: 15 },
      { period_index: 1, period: 101, median_key: 10 },
      { period_index: 2, period: 102, median_key: 12 },
    ];
    const result = computeAverageArc([rows]);
    expect(result.map(r => r.period_index)).toEqual([1, 2, 3]);
  });
});
```

- [ ] **Step 2: Run test — expect it to fail**

```bash
npm run test -- arc-utils
```

Expected: `Cannot find module './arc-utils.js'`

- [ ] **Step 3: Create the implementation**

```ts
// src/utils/arc-utils.ts
import type { WeeklyArcRow } from '../types.js';

export interface AverageArcPoint {
  period_index: number;
  median_key: number;
}

export function computeAverageArc(seasonRows: WeeklyArcRow[][]): AverageArcPoint[] {
  const byWeek = new Map<number, number[]>();
  for (const rows of seasonRows) {
    for (const row of rows) {
      if (!byWeek.has(row.period_index)) byWeek.set(row.period_index, []);
      byWeek.get(row.period_index)!.push(row.median_key);
    }
  }
  return Array.from(byWeek.entries())
    .map(([period_index, keys]) => ({
      period_index,
      median_key: keys.reduce((a, b) => a + b, 0) / keys.length,
    }))
    .sort((a, b) => a.period_index - b.period_index);
}
```

- [ ] **Step 4: Run test — expect it to pass**

```bash
npm run test -- arc-utils
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/arc-utils.ts src/utils/arc-utils.test.ts
git commit -m "✨ Add computeAverageArc utility with tests"
```

---

## Task 8: Arc multi mode rendering

**Files:**
- Modify: `src/charts/arc.ts`

- [ ] **Step 1: Add imports at the top of `arc.ts`**

Add to the existing imports:
```ts
import { dungeonColor } from '../utils/colors.js';
import { computeAverageArc } from '../utils/arc-utils.js';
```

In the existing `import type { DungeonManifest, SeasonMeta, WeeklyArcRow } from '../types.js'` line, add `DungeonMeta`:
```ts
import type { DungeonManifest, SeasonMeta, WeeklyArcRow, DungeonMeta } from '../types.js';
```

- [ ] **Step 2: Add `lastMultiData` cache variable inside `initArc`**

After the existing cache variables inside `initArc`:
```ts
let lastSelectionKey = '';
let lastSingleData: ArcEntry[] = [];
```

Add:
```ts
let lastMultiData = new Map<number, ArcEntry[]>();
```

- [ ] **Step 3: Fill in the multi mode branch in the subscribe callback**

Replace the `// multi mode — handled in a later task; skip for now` comment block inside the subscribe callback:

```ts
  if (state.selectedDungeons.length > 1) {
    const selectionKey = [...state.selectedDungeons].sort().join(',');

    if (selectionKey !== lastSelectionKey) {
      const newMultiData = new Map<number, ArcEntry[]>();

      for (const dungeonId of state.selectedDungeons) {
        if (lastMultiData.has(dungeonId)) {
          newMultiData.set(dungeonId, lastMultiData.get(dungeonId)!);
          continue;
        }
        const activeSeasons = manifest.seasons
          .filter(s => s.dungeonIds.includes(dungeonId) && s.id <= MAX_SEASON)
          .sort((a, b) => a.id - b.id);

        const entries = await Promise.all(
          activeSeasons.map(async (s, i) => {
            await loadSeason(s.id);
            const rows = await getWeeklyArc(conn, dungeonId, s.id);
            return {
              season: s,
              rows,
              colorIndex: i,
              secondaryAffixImpact: new Map<number, number>(),
            };
          }),
        );
        newMultiData.set(dungeonId, entries);
      }

      const currentKey = [...getState().selectedDungeons].sort().join(',');
      if (currentKey !== selectionKey) return;

      lastSelectionKey = selectionKey;
      lastMultiData = newMultiData;
      lastSingleData = [];
    }

    const selectedDungeons = state.selectedDungeons
      .map(id => manifest.dungeons.find(d => d.id === id))
      .filter((d): d is DungeonMeta => d !== undefined);

    renderMultiArc(container, selectedDungeons, lastMultiData);
    return;
  }
```

Also update the `lastSelectionKey` assignment in the single-mode branch so multi cache is cleared:
```ts
    if (getState().selectedDungeons[0] !== dungeonId) return;
    lastSelectionKey = selectionKey;
    lastMultiData.clear();   // ← add this line
```

- [ ] **Step 4: Add `renderMultiArc` function**

Add this function after the existing `renderArc` function in `arc.ts`:

```ts
function renderMultiArc(
  container: HTMLElement,
  dungeons: DungeonMeta[],
  dungeonData: Map<number, ArcEntry[]>,
): void {
  container.replaceChildren();
  container.style.position = 'relative';

  // Title
  const titleEl = document.createElement('div');
  titleEl.style.cssText =
    'padding:14px 16px 0;display:flex;align-items:center;justify-content:space-between;';
  const titleText = document.createElement('span');
  titleText.style.cssText = `font-size:${FONT.large}px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#e4e4e7`;
  titleText.textContent = `${dungeons.length} Dungeons — Median Key Level per Week`;
  titleEl.appendChild(titleText);
  container.appendChild(titleEl);

  // Legend
  const legendEl = document.createElement('div');
  legendEl.style.cssText = 'padding:6px 16px 4px;display:flex;gap:16px;flex-wrap:wrap;';
  for (let i = 0; i < dungeons.length; i++) {
    const color = dungeonColor(i);
    const item = document.createElement('div');
    item.style.cssText = 'display:flex;align-items:center;gap:5px;';
    const dot = document.createElement('span');
    dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;`;
    const label = document.createElement('span');
    label.style.cssText = `font-size:${FONT.small}px;color:#e4e4e7;`;
    label.textContent = dungeons[i].name;
    item.appendChild(dot);
    item.appendChild(label);
    legendEl.appendChild(item);
  }
  container.appendChild(legendEl);

  // Collect all rows to compute axis domains
  const allSeasonRows: ArcEntry[] = [];
  for (const entries of dungeonData.values()) allSeasonRows.push(...entries);
  if (allSeasonRows.length === 0 || allSeasonRows.every(e => e.rows.length === 0)) return;

  const LEGEND_H = 32;
  const totalTitleH = TITLE_H + LEGEND_H;
  const width = container.clientWidth - MARGIN.left - MARGIN.right;
  const height = container.clientHeight - MARGIN.top - MARGIN.bottom - totalTitleH;
  const maxPeriods = Math.max(...allSeasonRows.map(e => e.rows.length));

  const xScale = d3.scaleLinear().domain([1, maxPeriods]).range([0, width]);
  const yScale = d3.scaleLinear().domain(keyDomain).range([height, 0]);

  // Shared point type — both WeeklyArcRow and AverageArcPoint satisfy this
  type ArcPoint = { period_index: number; median_key: number };
  const lineGen = d3
    .line<ArcPoint>()
    .x(r => xScale(r.period_index))
    .y(r => yScale(r.median_key))
    .curve(d3.curveMonotoneX);

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', container.clientWidth)
    .attr('height', container.clientHeight - totalTitleH)
    .style('font-family', 'sans-serif');

  const g = svg
    .append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  drawAxes(g, xScale, yScale, height, width);

  for (let i = 0; i < dungeons.length; i++) {
    const dungeon = dungeons[i];
    const color = dungeonColor(i);
    const entries = dungeonData.get(dungeon.id) ?? [];

    // Thin per-season lines
    for (const { rows } of entries) {
      if (rows.length === 0) continue;
      g.append('path')
        .datum(rows as ArcPoint[])
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 1.2)
        .attr('opacity', 0.35)
        .attr('d', lineGen);
    }

    // Thick average line
    const avgRows = computeAverageArc(entries.map(e => e.rows));
    if (avgRows.length === 0) continue;

    g.append('path')
      .datum(avgRows as ArcPoint[])
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 3)
      .attr('opacity', 1)
      .attr('d', lineGen);

    // Circle markers on average line
    for (const pt of avgRows) {
      g.append('circle')
        .attr('cx', xScale(pt.period_index))
        .attr('cy', yScale(pt.median_key))
        .attr('r', 4)
        .attr('fill', color)
        .attr('opacity', 1)
        .style('pointer-events', 'none');
    }

    // End label
    const last = avgRows[avgRows.length - 1];
    g.append('text')
      .attr('x', xScale(last.period_index) + 4)
      .attr('y', yScale(last.median_key))
      .attr('font-size', FONT.small)
      .attr('fill', color)
      .attr('dominant-baseline', 'middle')
      .style('pointer-events', 'none')
      .text(dungeon.abbrev);
  }
}
```

Note: the local `ArcPoint` alias covers both `WeeklyArcRow` (which has an extra `period` field, accepted by structural subtyping) and `AverageArcPoint`. The `as ArcPoint[]` casts make the line generator happy without losing type safety.

- [ ] **Step 5: Build**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 6: Run all tests**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/charts/arc.ts
git commit -m "✨ Arc: add multi-dungeon mode with per-season thin lines and average thick line"
```

---

## Task 9: Affix panel multi mode — stacked per-dungeon matrices

**Files:**
- Modify: `src/charts/affix.ts`

- [ ] **Step 1: Add imports**

Add to existing imports in `src/charts/affix.ts`:
```ts
import { loadSeason } from '../db/init.js';
import { dungeonColor } from '../utils/colors.js';
```

- [ ] **Step 2: Replace the state cache variable and subscribe callback**

Replace:
```ts
let lastDungeonId: number | null | undefined = undefined;

subscribe(async state => {
  const dungeonId = state.selectedDungeons.length === 1 ? state.selectedDungeons[0] : null;
  if (dungeonId === lastDungeonId) return;
  lastDungeonId = dungeonId;
```

With:
```ts
let lastSelectionKey = '';

subscribe(async state => {
  const selectionKey = [...state.selectedDungeons].sort().join(',');
  if (selectionKey === lastSelectionKey) return;
  lastSelectionKey = selectionKey;
```

- [ ] **Step 3: Replace the dungeon-null early-return guard**

The old code checked `if (dungeonId === null)` to show empty/multi message. Replace with:

```ts
    container.innerHTML = '';

    if (state.selectedDungeons.length === 0) {
      const div = document.createElement('div');
      div.style.cssText = 'color:#999;text-align:center;padding:20px;';
      div.textContent = 'Select a dungeon to analyze affixes.';
      container.appendChild(div);
      return;
    }
```

Remove the old block:
```ts
    // DELETE this old block:
    if (dungeonId === null) {
      const msg = state.selectedDungeons.length === 0
        ? 'Select a dungeon to analyze affixes.'
        : 'Select a single dungeon to analyze affixes.';
      const div = document.createElement('div');
      div.style.cssText = 'color:#999;text-align:center;padding:20px;';
      div.textContent = msg;
      container.appendChild(div);
      return;
    }
```

- [ ] **Step 4: Replace the single-dungeon rendering block with a loop over `selectedDungeons`**

Replace everything from `const dungeon = manifest.dungeons.find(...)` to the end of the `subscribe` callback with:

```ts
    for (let idx = 0; idx < state.selectedDungeons.length; idx++) {
      const dungeonId = state.selectedDungeons[idx];
      const dungeon = manifest.dungeons.find(d => d.id === dungeonId);
      if (!dungeon) continue;

      const color = state.selectedDungeons.length === 1 ? '#e4e4e7' : dungeonColor(idx);

      const availableSeasons = manifest.seasons
        .filter(s => s.dungeonIds.includes(dungeonId) && s.id <= MAX_SEASON)
        .map(s => s.id)
        .sort((a, b) => a - b);

      if (availableSeasons.length === 0) continue;

      // Ensure parquet data is loaded for each season
      await Promise.all(availableSeasons.map(id => loadSeason(id)));

      const title = document.createElement('div');
      title.style.cssText = `padding:16px;font-size:${FONT.large}px;font-weight:bold;color:${color};border-bottom:1px solid #27272a;`;
      title.textContent = `${dungeon.name} — Affix Impact`;
      container.appendChild(title);

      const matrixContainer = document.createElement('div');
      matrixContainer.style.cssText = 'padding:20px;overflow-x:auto;';
      container.appendChild(matrixContainer);

      try {
        const [primaryDeltas, secondaryData] = await Promise.all([
          getPrimaryAffixDeltaBySeason(conn, dungeonId, availableSeasons),
          getSecondaryAffixImpactAllSeasons(conn, dungeonId, availableSeasons),
        ]);

        const matrixData = buildAffixMatrixData(dungeonId, availableSeasons, primaryDeltas, secondaryData);
        renderAffixMatrix(matrixContainer, matrixData, (seasonId) => {
          setState({ selectedSeasonForArc: seasonId });
        });
      } catch (err) {
        console.error('Affix matrix error:', err);
        const errDiv = document.createElement('div');
        errDiv.style.cssText = 'color:#ef4444;padding:20px;';
        errDiv.textContent = 'Error loading affix data.';
        matrixContainer.appendChild(errDiv);
      }
    }
```

Note: when `selectedDungeons.length === 1`, the title color stays neutral (`#e4e4e7`) to match the existing single-dungeon appearance. When multiple dungeons are selected, each header uses its arc color.

- [ ] **Step 5: Build**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 6: Run all tests**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/charts/affix.ts
git commit -m "✨ Affix: stacked per-dungeon matrices for multi-dungeon selection"
```

---

## Verification

After all tasks, do a manual smoke test:

1. Run `npm run dev`
2. Click one dungeon on the map → arc shows single-dungeon seasonal lines, affix shows one matrix
3. Click a second dungeon on the dungeon browser → arc switches to multi mode (thin lines + thick average per dungeon), affix stacks two matrices
4. Click a third and fourth dungeon → both charts update; counter shows "4 / 4 selected"
5. Click a fifth dungeon → no change (cap enforced)
6. Click a selected dungeon to deselect it → selection shrinks, charts update
7. Deselect all → arc shows empty state, affix shows empty state
8. Verify tile colors: selected = yellow, hovered = white, unselected = faded
