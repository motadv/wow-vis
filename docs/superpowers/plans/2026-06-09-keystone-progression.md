# Keystone Progression Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the volume-based detail and scrubber panels with a cross-season heatmap (showing each dungeon's within-season rank) and a weekly arc chart (showing how a dungeon's key ceiling evolved over each season).

**Architecture:** The world map stays as the geographic navigation anchor. The right panel becomes a heatmap matrix (dungeons × seasons, color = within-season rank) that loads all seasons upfront. Below the map+heatmap split sits a full-width arc panel that renders on dungeon selection. All coordination goes through the existing pub/sub state module.

**Tech Stack:** D3.js, DuckDB-Wasm, TypeScript, Vite, Vitest.

**Spec:** `docs/specs/2026-06-09-keystone-progression-design.md`

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `src/types.ts` | Replace volume/dist/crossSeason row types; add RankMatrixRow, WeeklyArcRow |
| Modify | `src/state.ts` | Remove viewMode/filterEras/selectedSeason; add selectedSeasonForArc |
| Create | `src/utils/ranks.ts` | Pure normalization function `computeRanks` |
| Create | `src/utils/ranks.test.ts` | Unit tests for computeRanks |
| Modify | `src/db/queries.ts` | Replace all 3 old queries with getSeasonRankMatrix + getWeeklyArc |
| Modify | `index.html` | Remove #filters/#scrubber; replace #detail with #heatmap; add #arc |
| Modify | `src/style.css` | New layout for #heatmap and #arc zones |
| Modify | `src/charts/map.ts` | Fixed-radius circles; remove volume/filterEras dependencies |
| Create | `src/charts/heatmap.ts` | `initHeatmap` — D3 matrix chart |
| Create | `src/charts/arc.ts` | `initArc` — D3 multi-line chart |
| Modify | `src/charts/init.ts` | Wire up new charts; remove old subscriptions |
| Delete | `src/charts/detail/era.ts` | Old era bar chart |
| Delete | `src/charts/detail/reintroduction.ts` | Old reintroduction chart |
| Delete | `src/charts/detail/index.ts` | Old detail orchestrator |
| Delete | `src/charts/scrubber.ts` | Old season scrubber |
| Delete | `src/charts/filters.ts` | Old era/mode filter bar |

---

## Task 1: Update Types and State

**Files:**
- Modify: `src/types.ts`
- Modify: `src/state.ts`

- [ ] **Step 1: Replace row types in `src/types.ts`**

  Remove `VolumeRow`, `KeyDistRow`, `CrossSeasonRow`. Add:

  ```ts
  export interface RankMatrixRow {
    dungeon_id: number;
    season_id: number;
    median_key: number;
  }

  export interface WeeklyArcRow {
    period_index: number;  // 1-based, derived from ordering raw period IDs ascending
    median_key: number;
  }
  ```

  Also update `AppState` — remove `selectedSeason`, `viewMode`, `filterEras`; add:

  ```ts
  selectedSeasonForArc: number | null;  // which season's line is emphasized; null = all equal
  ```

  Final `AppState`:
  ```ts
  export interface AppState {
    selectedDungeon: number | null;
    selectedSeasonForArc: number | null;
  }
  ```

- [ ] **Step 2: Update `src/state.ts` initial state**

  Change the initial state object to match the new `AppState`:
  ```ts
  let state: AppState = {
    selectedDungeon: null,
    selectedSeasonForArc: null,
  };
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: errors on files that still reference `VolumeRow`, `viewMode`, `filterEras`, `selectedSeason` — these will be fixed in subsequent tasks. Confirm the errors are only from the files listed in the File Map (not from types.ts or state.ts themselves).

- [ ] **Step 4: Commit**

  ```bash
  git add src/types.ts src/state.ts
  git commit -m "♻️ Update AppState: add selectedSeasonForArc, remove volume/era state"
  ```

---

## Task 2: Rank Normalization Utility

**Files:**
- Create: `src/utils/ranks.ts`
- Create: `src/utils/ranks.test.ts`

- [ ] **Step 1: Write failing tests in `src/utils/ranks.test.ts`**

  Import the not-yet-existing function and write three tests:

  ```ts
  import { describe, it, expect } from 'vitest';
  import { computeRanks } from './ranks.js';
  import type { RankMatrixRow } from '../types.js';

  describe('computeRanks', () => {
    it('assigns rank 1 to the highest median key in a season', () => {
      const input: RankMatrixRow[] = [
        { dungeon_id: 1, season_id: 10, median_key: 20 },
        { dungeon_id: 2, season_id: 10, median_key: 25 },
        { dungeon_id: 3, season_id: 10, median_key: 18 },
      ];
      const result = computeRanks(input);
      const d2 = result.find(r => r.dungeon_id === 2)!;
      expect(d2.rank).toBe(1);
      expect(d2.total).toBe(3);
    });

    it('assigns ranks independently per season', () => {
      const input: RankMatrixRow[] = [
        { dungeon_id: 1, season_id: 6, median_key: 30 },
        { dungeon_id: 2, season_id: 6, median_key: 25 },
        { dungeon_id: 2, season_id: 7, median_key: 22 },
        { dungeon_id: 1, season_id: 7, median_key: 28 },
      ];
      const result = computeRanks(input);
      const d1s6 = result.find(r => r.dungeon_id === 1 && r.season_id === 6)!;
      const d2s7 = result.find(r => r.dungeon_id === 2 && r.season_id === 7)!;
      expect(d1s6.rank).toBe(1);  // highest in season 6
      expect(d2s7.rank).toBe(2);  // second in season 7
    });

    it('handles a single dungeon in a season', () => {
      const input: RankMatrixRow[] = [
        { dungeon_id: 5, season_id: 15, median_key: 16 },
      ];
      const result = computeRanks(input);
      expect(result[0].rank).toBe(1);
      expect(result[0].total).toBe(1);
    });
  });
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  npm test
  ```

  Expected: 3 failures with "Cannot find module './ranks.js'".

- [ ] **Step 3: Implement `src/utils/ranks.ts`**

  Export one type and one function:

  ```ts
  import type { RankMatrixRow } from '../types.js';

  export interface RankedMatrixRow extends RankMatrixRow {
    rank: number;   // 1 = highest median key in this season
    total: number;  // number of dungeons active in this season
  }

  export function computeRanks(rows: RankMatrixRow[]): RankedMatrixRow[]
  ```

  Implementation: group rows by `season_id`, sort each group descending by `median_key`, assign `rank` 1..N and `total` = group size.

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  npm test
  ```

  Expected: 3 passing, 0 failing.

- [ ] **Step 5: Commit**

  ```bash
  git add src/utils/ranks.ts src/utils/ranks.test.ts
  git commit -m "✨ Add computeRanks normalization utility"
  ```

---

## Task 3: Update Database Queries

**Files:**
- Modify: `src/db/queries.ts`

- [ ] **Step 1: Replace all content of `src/db/queries.ts`**

  Remove the three old functions. Add two new ones:

  **`getSeasonRankMatrix(conn, seasonId): Promise<RankMatrixRow[]>`**

  SQL:
  ```sql
  SELECT dungeon_id::INTEGER AS dungeon_id,
         MEDIAN(keystone_level)::FLOAT AS median_key
  FROM leaderboard_${seasonId}
  GROUP BY dungeon_id
  ```

  Post-process: map each row to `{ dungeon_id: Number(...), season_id: seasonId, median_key: Number(...) }`.

  **`getWeeklyArc(conn, dungeonId, seasonId): Promise<WeeklyArcRow[]>`**

  SQL:
  ```sql
  SELECT period::INTEGER AS period,
         MEDIAN(keystone_level)::FLOAT AS median_key
  FROM leaderboard_${seasonId}
  WHERE dungeon_id = ${dungeonId}
  GROUP BY period
  ORDER BY period ASC
  ```

  Post-process: sort by period ascending, then map to `{ period_index: i + 1, median_key: Number(...) }` (1-based index, discarding raw Blizzard period IDs).

- [ ] **Step 2: Verify TypeScript compiles (queries only)**

  ```bash
  npx tsc --noEmit 2>&1 | grep "queries"
  ```

  Expected: no errors in `src/db/queries.ts`.

- [ ] **Step 3: Commit**

  ```bash
  git add src/db/queries.ts
  git commit -m "♻️ Replace volume/dist queries with getSeasonRankMatrix + getWeeklyArc"
  ```

---

## Task 4: Restructure Layout

**Files:**
- Modify: `index.html`
- Modify: `src/style.css`

- [ ] **Step 1: Update `index.html`**

  Remove `<div id="filters">` and `<div id="scrubber">`. Replace `<div id="detail">` with `<div id="heatmap">`. Add `<div id="arc">` as a sibling to `#middle` (outside it, below it):

  ```html
  <div id="layout">
    <div id="middle">
      <div id="map"></div>
      <div id="heatmap"></div>
    </div>
    <div id="arc"></div>
  </div>
  ```

- [ ] **Step 2: Update `src/style.css`**

  Remove the `#filters`, `#detail`, `#detail.open`, and `#scrubber` blocks. Update `#layout` to a two-row grid (middle + arc), and add styles for `#heatmap` and `#arc`:

  ```css
  #layout {
    display: grid;
    grid-template-rows: 1fr 220px;
    height: 100vh;
  }

  #middle {
    display: flex;
    overflow: hidden;
  }

  #map {
    flex: 1;
    overflow: hidden;
    background: #09090b;
  }

  #heatmap {
    width: 480px;
    flex-shrink: 0;
    overflow-y: auto;
    background: #18181b;
    border-left: 1px solid #27272a;
  }

  #arc {
    border-top: 1px solid #27272a;
    background: #18181b;
    overflow: hidden;
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add index.html src/style.css
  git commit -m "♻️ Restructure layout: heatmap + arc zones replace detail/scrubber/filters"
  ```

---

## Task 5: Clean Up Map

**Files:**
- Modify: `src/charts/map.ts`

The map currently sizes circles by `entry_count` via `rScale` and dims dungeons based on `filterEras`. Both must be removed.

- [ ] **Step 1: Remove volume-based sizing**

  Delete module-level `let volumeMap`, `let rScale`, and the `updateVolume` export. The function is called from `init.ts` — that call will be removed in Task 8.

- [ ] **Step 2: Fix circle radius and opacity**

  In `renderNodes`, change `r` from `rScale(v.entry_count)` to the fixed value `14`. Change the `opacity` logic to only check `selectedDungeon` (remove the `activeEras` check):

  ```ts
  .attr('opacity', (d) =>
    state.selectedDungeon !== null && d.id !== state.selectedDungeon ? 0.5 : 1
  )
  ```

- [ ] **Step 3: Fix the `click` handler**

  Map clicks should clear `selectedSeasonForArc` (no specific season emphasized):

  ```ts
  .on('click', (_event, d) => setState({ selectedDungeon: d.id, selectedSeasonForArc: null }))
  ```

- [ ] **Step 4: Remove now-unused imports**

  Remove the `VolumeRow` type import and any config imports only used for `filterEras`.

- [ ] **Step 5: Verify no TypeScript errors in map.ts**

  ```bash
  npx tsc --noEmit 2>&1 | grep "map.ts"
  ```

  Expected: no output.

- [ ] **Step 6: Commit**

  ```bash
  git add src/charts/map.ts
  git commit -m "♻️ Map: fixed-radius circles, remove volume/era-filter dependencies"
  ```

---

## Task 6: Implement Heatmap Chart

**Files:**
- Create: `src/charts/heatmap.ts`

- [ ] **Step 1: Create `src/charts/heatmap.ts` with the `initHeatmap` signature**

  ```ts
  import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
  import type { DungeonManifest } from '../types.js';

  export async function initHeatmap(
    container: HTMLElement,
    manifest: DungeonManifest,
    conn: AsyncDuckDBConnection,
  ): Promise<void>
  ```

- [ ] **Step 2: Load all season data**

  Inside `initHeatmap`:
  1. Filter `manifest.seasons` to those with `dungeonIds.length > 0`, sort ascending by `id`.
  2. Show `container.textContent = 'Loading…'` while loading.
  3. Call `loadSeason(s.id)` for all seasons via `Promise.all`.
  4. For each season, call `getSeasonRankMatrix(conn, s.id)` and accumulate into a flat `RankMatrixRow[]`.
  5. Call `computeRanks(allRows)` to get `RankedMatrixRow[]`.
  6. Build a lookup `Map<dungeonId, Map<seasonId, { rank, total, median_key }>>`.
  7. Clear the loading text: `container.textContent = ''`.

- [ ] **Step 3: Sort dungeons and compute SVG dimensions**

  Dungeon row order: sort by mean normalized value descending (best-pushed at top).
  Normalized value for a cell = `total === 1 ? 1 : 1 - (rank - 1) / (total - 1)`.

  Constants:
  ```ts
  const LABEL_W = 180;
  const CELL_H = 22;
  const CELL_W = 34;
  const HEADER_H = 64;
  ```

  SVG width = `LABEL_W + seasons.length * CELL_W + 10`.
  SVG height = `HEADER_H + dungeons.length * CELL_H + 10`.

- [ ] **Step 4: Render season column headers**

  Append `<text>` elements for each season label. Use abbreviated names (strip "Mythic+ Dungeons (" prefix and trailing ")"). Rotate them −45° around their anchor point so they don't overlap with narrow cells.

- [ ] **Step 5: Render dungeon rows**

  For each dungeon (in sorted order), append a `<g>` group translated to `(0, HEADER_H + i * CELL_H)`. Inside:
  - A `<text>` for the dungeon name at `x = LABEL_W - 6`, colored with `ERA_PALETTE[dungeon.era]`.
  - For each season column: a `<rect>` cell filled with `d3.scaleSequential(d3.interpolateBlues).domain([0,1])(normalizedValue)` for active seasons, or `#27272a` for inactive seasons (dungeon not in that season).
  - Each active cell gets a `<title>` tooltip: dungeon name, season name, raw median key, rank (e.g. "Rank 2 of 8").
  - Active cell `click` handler: `setState({ selectedDungeon: dungeon.id, selectedSeasonForArc: season.id })`.

- [ ] **Step 6: Subscribe to selectedDungeon for row highlight**

  After rendering, call `subscribe` to dim all rows except the selected dungeon's row:

  ```ts
  subscribe((state) => {
    svg.selectAll<SVGGElement, DungeonMeta>('.dungeon-row')
      .attr('opacity', d =>
        state.selectedDungeon === null || d.id === state.selectedDungeon ? 1 : 0.4
      );
  });
  ```

- [ ] **Step 7: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit 2>&1 | grep "heatmap"
  ```

  Expected: no output.

- [ ] **Step 8: Commit**

  ```bash
  git add src/charts/heatmap.ts
  git commit -m "✨ Add cross-season heatmap chart"
  ```

---

## Task 7: Implement Arc Chart

**Files:**
- Create: `src/charts/arc.ts`

- [ ] **Step 1: Create `src/charts/arc.ts` with the `initArc` signature**

  ```ts
  import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
  import type { DungeonManifest } from '../types.js';

  export function initArc(
    container: HTMLElement,
    manifest: DungeonManifest,
    conn: AsyncDuckDBConnection,
  ): void
  ```

  `initArc` is synchronous — it just registers a subscriber. All async work happens inside the subscriber.

- [ ] **Step 2: Render the empty state**

  At the top of `initArc`, append a `<p>` element with text:
  `"Select a dungeon on the map or heatmap to see its weekly progression."`
  Style: `padding:16px; font-size:12px; color:#71717a; text-align:center`.

- [ ] **Step 3: Subscribe and re-render on dungeon change**

  Declare module-level (within the closure):
  - `let lastDungeonId: number | null = null`
  - `let lastArcData: Array<{ season: SeasonMeta; rows: WeeklyArcRow[]; colorIndex: number }> = []`

  In the subscriber:
  - If `state.selectedDungeon === null`: clear container, re-append empty-state `<p>`, reset `lastDungeonId = null`, return.
  - If `state.selectedDungeon !== lastDungeonId`: fetch arc data (load seasons + call `getWeeklyArc`) for all seasons the dungeon appeared in, store in `lastArcData`, set `lastDungeonId`.
  - After fetching (or if only `selectedSeasonForArc` changed), call `renderArc(container, dungeonName, lastArcData, state.selectedSeasonForArc)`.

  Guard against stale renders: capture `const dungeonAtStart = state.selectedDungeon` before any `await`, then check `if (getState().selectedDungeon !== dungeonAtStart) return` before rendering.

- [ ] **Step 4: Implement `renderArc`**

  Private function with signature:
  ```ts
  function renderArc(
    container: HTMLElement,
    title: string,
    arcs: Array<{ season: SeasonMeta; rows: WeeklyArcRow[]; colorIndex: number }>,
    emphasizedSeasonId: number | null,
  ): void
  ```

  Layout:
  - Margins: `{ top: 20, right: 140, bottom: 30, left: 44 }`
  - Width: `container.clientWidth - margin.left - margin.right`
  - Height: `container.clientHeight - margin.top - margin.bottom - 4`

  Scales:
  - X: `d3.scaleLinear().domain([1, maxPeriods])` where `maxPeriods = Math.max(...arcs.map(a => a.rows.length))`
  - Y: `d3.scaleLinear().domain([minKey, maxKey])` across all arcs, with a small padding

  Colors: `d3.schemeTableau10` cycled by `colorIndex % 10`.

  For each arc:
  - Draw a `<path>` using `d3.line()` mapping `(row.period_index, row.median_key)` to `(xScale, yScale)`.
  - If `season.id === emphasizedSeasonId` (or `emphasizedSeasonId === null`): stroke-width 2.5, opacity 1.
  - Otherwise: stroke-width 1.5, opacity 0.3.

  Draw X and Y axes. X axis label: "Week". Y axis label: "Median Key".

  Legend: one row per season at `x = width + margin.left + 8`. A small colored circle + season name abbreviated to fit. Clicking a legend item calls `setState({ selectedSeasonForArc: season.id })`.

  Clear container before rendering: `container.replaceChildren()`.

- [ ] **Step 5: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit 2>&1 | grep "arc.ts"
  ```

  Expected: no output.

- [ ] **Step 6: Commit**

  ```bash
  git add src/charts/arc.ts
  git commit -m "✨ Add weekly arc chart"
  ```

---

## Task 8: Wire Up Orchestration and Delete Old Files

**Files:**
- Modify: `src/charts/init.ts`
- Delete: `src/charts/detail/era.ts`, `src/charts/detail/reintroduction.ts`, `src/charts/detail/index.ts`
- Delete: `src/charts/scrubber.ts`, `src/charts/filters.ts`

- [ ] **Step 1: Rewrite `src/charts/init.ts`**

  Replace the full file contents. The new `initViz`:
  1. `await initDB()`
  2. `fetch('/data/dungeons.json')` → `manifest`
  3. `const conn = getConnection()`
  4. `initMap(document.getElementById('map')!, manifest)`
  5. `initArc(document.getElementById('arc')!, manifest, conn)` — synchronous, sets up subscriber
  6. `await initHeatmap(document.getElementById('heatmap')!, manifest, conn)` — async, loads all seasons

  Imports: `initDB`, `getConnection` from `'../db/init.js'`; `initMap` from `'./map.js'`; `initHeatmap` from `'./heatmap.js'`; `initArc` from `'./arc.js'`; `DungeonManifest` from `'../types.js'`.

  No `setState` call — no initial season to select; the heatmap owns startup.

- [ ] **Step 2: Delete the five old files**

  ```bash
  git rm src/charts/detail/era.ts \
         src/charts/detail/reintroduction.ts \
         src/charts/detail/index.ts \
         src/charts/scrubber.ts \
         src/charts/filters.ts
  ```

- [ ] **Step 3: Full TypeScript check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: 0 errors.

- [ ] **Step 4: Run tests**

  ```bash
  npm test
  ```

  Expected: `computeRanks` tests all pass.

- [ ] **Step 5: Start the dev server and visually verify**

  ```bash
  npm run dev
  ```

  Open `http://localhost:5173` and confirm:
  - Map renders with fixed-size era-colored circles.
  - Heatmap panel shows "Loading…" briefly, then renders the full dungeon × season matrix with blue-scale cells.
  - Arc panel shows the empty-state prompt.
  - Clicking a dungeon on the map highlights it in the heatmap and renders its arc below.
  - Clicking a heatmap cell selects that dungeon+season and emphasizes the correct arc line.
  - Clicking an arc legend item changes which line is emphasized.

- [ ] **Step 6: Commit**

  ```bash
  git add src/charts/init.ts
  git commit -m "✨ Wire up heatmap + arc; remove old detail/scrubber/filters modules"
  ```
