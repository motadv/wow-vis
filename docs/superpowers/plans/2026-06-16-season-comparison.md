# Season Comparison View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared-season comparison mode to the multi-dungeon arc panel, with season chips, per-season line chart, leader ribbon, and an affix-aware tooltip.

**Architecture:** All changes live in `src/charts/arc.ts`. Two pure utility functions go in `src/utils/arc-utils.ts` and are tested in `src/utils/arc-utils.test.ts`. The comparison season is tracked as closure-local state inside `initArc` alongside the existing `lastMultiData` cache.

**Tech Stack:** D3.js, TypeScript (strict), Vitest

---

## File Map

- **Modify:** `src/utils/arc-utils.ts` — add `computeSharedSeasons`, `computeWeekLeaders`
- **Modify:** `src/utils/arc-utils.test.ts` — add tests for both new functions
- **Modify:** `src/charts/arc.ts` — extend closure, update `renderMultiArc` signature, add chip row, comparison view, leader ribbon, comparison tooltip

---

## Task 1: `computeSharedSeasons` utility

**Files:**
- Modify: `src/utils/arc-utils.ts`
- Modify: `src/utils/arc-utils.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/utils/arc-utils.test.ts`, after existing imports:

```ts
import { computeAverageArc, collectAtWeek, computeSharedSeasons, computeWeekLeaders } from './arc-utils.js';
import type { SeasonMeta } from '../types.js';
```

Replace the existing import line `import { computeAverageArc, collectAtWeek } from './arc-utils.js';` with the one above, then add:

```ts
describe('computeSharedSeasons', () => {
  const seasons: SeasonMeta[] = [
    { id: 4, name: 'S4', startTimestamp: 0, dungeonIds: [1, 2, 3] },
    { id: 5, name: 'S5', startTimestamp: 0, dungeonIds: [1, 2] },
    { id: 6, name: 'S6', startTimestamp: 0, dungeonIds: [1, 3] },
    { id: 7, name: 'S7', startTimestamp: 0, dungeonIds: [2, 3] },
    { id: 8, name: 'S8', startTimestamp: 0, dungeonIds: [1, 2, 3] },
  ];
  const disabled = new Set([5]);
  const max = 7;

  it('returns only seasons where all given dungeon ids appear', () => {
    const result = computeSharedSeasons(seasons, [1, 2], disabled, max);
    expect(result.map(s => s.id)).toEqual([4]);
  });

  it('excludes disabled seasons', () => {
    const result = computeSharedSeasons(seasons, [1, 2], disabled, max);
    expect(result.map(s => s.id)).not.toContain(5);
  });

  it('excludes seasons beyond maxSeason', () => {
    const result = computeSharedSeasons(seasons, [1, 2, 3], disabled, max);
    expect(result.map(s => s.id)).not.toContain(8);
  });

  it('returns results sorted by id ascending', () => {
    const result = computeSharedSeasons(seasons, [1], disabled, max);
    expect(result.map(s => s.id)).toEqual([4, 6]);
  });

  it('returns empty array when no season contains all dungeons', () => {
    const result = computeSharedSeasons(seasons, [1, 2, 3], disabled, max);
    expect(result.map(s => s.id)).toEqual([4]);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run src/utils/arc-utils.test.ts
```

Expected: FAIL — `computeSharedSeasons` is not exported.

- [ ] **Step 3: Implement `computeSharedSeasons`**

Add to `src/utils/arc-utils.ts` (after existing imports, add `SeasonMeta` import):

```ts
import type { WeeklyArcRow, SeasonMeta } from '../types.js';
```

Then add the function:

```ts
export function computeSharedSeasons(
  seasons: SeasonMeta[],
  dungeonIds: number[],
  disabledSeasons: Set<number>,
  maxSeason: number,
): SeasonMeta[] {
  return seasons
    .filter(s =>
      s.id <= maxSeason &&
      !disabledSeasons.has(s.id) &&
      dungeonIds.every(id => s.dungeonIds.includes(id)),
    )
    .sort((a, b) => a.id - b.id);
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run src/utils/arc-utils.test.ts
```

Expected: all `computeSharedSeasons` tests pass, existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/arc-utils.ts src/utils/arc-utils.test.ts
git commit -m "✨ Add computeSharedSeasons utility"
```

---

## Task 2: `computeWeekLeaders` utility

**Files:**
- Modify: `src/utils/arc-utils.ts`
- Modify: `src/utils/arc-utils.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/utils/arc-utils.test.ts`:

```ts
describe('computeWeekLeaders', () => {
  it('returns the dungeon with the highest median_key each week', () => {
    const dungeons = [{ id: 1 }, { id: 2 }];
    const rows = new Map<number, { period_index: number; median_key: number }[]>([
      [1, [{ period_index: 1, median_key: 20 }, { period_index: 2, median_key: 10 }]],
      [2, [{ period_index: 1, median_key: 15 }, { period_index: 2, median_key: 25 }]],
    ]);
    const result = computeWeekLeaders(dungeons, rows);
    expect(result.get(1)).toBe(1);
    expect(result.get(2)).toBe(2);
  });

  it('assigns the first dungeon in selection order on a tie', () => {
    const dungeons = [{ id: 1 }, { id: 2 }];
    const rows = new Map<number, { period_index: number; median_key: number }[]>([
      [1, [{ period_index: 1, median_key: 15 }]],
      [2, [{ period_index: 1, median_key: 15 }]],
    ]);
    const result = computeWeekLeaders(dungeons, rows);
    expect(result.get(1)).toBe(1);
  });

  it('covers all weeks present across any dungeon', () => {
    const dungeons = [{ id: 1 }, { id: 2 }];
    const rows = new Map<number, { period_index: number; median_key: number }[]>([
      [1, [{ period_index: 1, median_key: 10 }, { period_index: 3, median_key: 12 }]],
      [2, [{ period_index: 2, median_key: 20 }]],
    ]);
    const result = computeWeekLeaders(dungeons, rows);
    expect(result.size).toBe(3);
  });

  it('returns an empty map when dungeon list is empty', () => {
    const result = computeWeekLeaders([], new Map());
    expect(result.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run src/utils/arc-utils.test.ts
```

Expected: FAIL — `computeWeekLeaders` is not exported.

- [ ] **Step 3: Implement `computeWeekLeaders`**

Add to `src/utils/arc-utils.ts`:

```ts
export function computeWeekLeaders(
  dungeons: ReadonlyArray<{ id: number }>,
  rowsByDungeon: Map<number, ReadonlyArray<{ period_index: number; median_key: number }>>,
): Map<number, number> {
  const allPeriods = new Set<number>();
  for (const rows of rowsByDungeon.values()) {
    for (const r of rows) allPeriods.add(r.period_index);
  }

  const leaders = new Map<number, number>();
  for (const period of allPeriods) {
    let maxKey = -Infinity;
    let leaderId = dungeons[0]?.id ?? -1;
    for (const dungeon of dungeons) {
      const row = (rowsByDungeon.get(dungeon.id) ?? []).find(r => r.period_index === period);
      if (row && row.median_key > maxKey) {
        maxKey = row.median_key;
        leaderId = dungeon.id;
      }
    }
    leaders.set(period, leaderId);
  }
  return leaders;
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run src/utils/arc-utils.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/arc-utils.ts src/utils/arc-utils.test.ts
git commit -m "✨ Add computeWeekLeaders utility"
```

---

## Task 3: Closure vars, chip row, `renderMultiArc` signature

**Files:**
- Modify: `src/charts/arc.ts`

After this task, chips appear in the panel but clicking them only toggles back to overview (comparison view is a stub). TypeScript must compile cleanly.

- [ ] **Step 1: Add imports and `CHIP_H` constant**

At the top of `src/charts/arc.ts`, update the `arc-utils` import:

```ts
import { computeAverageArc, collectAtWeek, computeSharedSeasons } from "../utils/arc-utils.js";
```

After the existing `const TITLE_H = 48;` line, add:

```ts
const CHIP_H = 36;
```

- [ ] **Step 2: Add closure variables to `initArc`**

Inside `initArc`, after `let lastMultiData = new Map<number, ArcEntry[]>();`, add:

```ts
let comparisonSeasonId: number | null = null;
const affixImpactCache = new Map<string, Map<number, { affixName: string; impactDelta: number }>>();
```

- [ ] **Step 3: Define `onSelectSeason` before `subscribe`**

Inside `initArc`, after the new closure variables, add:

```ts
const onSelectSeason = (seasonId: number | null): void => {
  comparisonSeasonId = seasonId;
  const currentState = getState();
  const selectedDungeons = currentState.selectedDungeons
    .map(id => manifest.dungeons.find(d => d.id === id))
    .filter((d): d is DungeonMeta => d !== undefined);
  const sharedSeasons = computeSharedSeasons(
    manifest.seasons,
    currentState.selectedDungeons,
    DISABLED_SEASONS,
    MAX_SEASON,
  );
  renderMultiArc(container, selectedDungeons, lastMultiData, sharedSeasons, comparisonSeasonId, onSelectSeason, affixImpactCache);
};
```

- [ ] **Step 4: Reset `comparisonSeasonId` on selection change**

In the `subscribe` callback, inside the `if (state.selectedDungeons.length > 1)` block, at the top of the `if (selectionKey !== lastSelectionKey)` block, add:

```ts
comparisonSeasonId = null;
```

- [ ] **Step 5: Update the `renderMultiArc` call site in `subscribe`**

Replace the existing:
```ts
renderMultiArc(container, selectedDungeons, lastMultiData);
```
with:
```ts
const sharedSeasons = computeSharedSeasons(
  manifest.seasons,
  state.selectedDungeons,
  DISABLED_SEASONS,
  MAX_SEASON,
);
renderMultiArc(container, selectedDungeons, lastMultiData, sharedSeasons, comparisonSeasonId, onSelectSeason, affixImpactCache);
```

- [ ] **Step 6: Update `renderMultiArc` signature**

Change the function signature from:
```ts
function renderMultiArc(
  container: HTMLElement,
  dungeons: DungeonMeta[],
  dungeonData: Map<number, ArcEntry[]>,
): void {
```
to:
```ts
function renderMultiArc(
  container: HTMLElement,
  dungeons: DungeonMeta[],
  dungeonData: Map<number, ArcEntry[]>,
  sharedSeasons: SeasonMeta[],
  comparisonSeasonId: number | null,
  onSelectSeason: (id: number | null) => void,
  affixImpactCache: Map<string, Map<number, { affixName: string; impactDelta: number }>>,
): void {
```

- [ ] **Step 7: Add chip row render call inside `renderMultiArc`**

Inside `renderMultiArc`, after `container.appendChild(legendEl);`, add:

```ts
if (sharedSeasons.length > 0) {
  renderSeasonChips(container, sharedSeasons, comparisonSeasonId, onSelectSeason);
}
```

- [ ] **Step 8: Add `renderSeasonChips` function**

Add this new function before `renderMultiArc`:

```ts
function renderSeasonChips(
  container: HTMLElement,
  sharedSeasons: SeasonMeta[],
  activeSeasonId: number | null,
  onSelect: (id: number | null) => void,
): void {
  const row = document.createElement("div");
  row.style.cssText =
    "padding:4px 16px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center;";

  const label = document.createElement("span");
  label.style.cssText = `font-size:${FONT.small}px;color:#52525b;`;
  label.textContent = "Compare in:";
  row.appendChild(label);

  for (const season of sharedSeasons) {
    const isActive = season.id === activeSeasonId;
    const chip = document.createElement("button");
    chip.style.cssText = [
      `font-size:${FONT.small}px`,
      "font-family:sans-serif",
      "cursor:pointer",
      "border-radius:4px",
      "padding:2px 8px",
      isActive
        ? "background:#3f3f46;border:1px solid #a1a1aa;color:#e4e4e7"
        : "background:transparent;border:1px solid #3f3f46;color:#71717a",
    ].join(";");
    chip.textContent = `S${season.id}`;
    chip.addEventListener("click", () => onSelect(isActive ? null : season.id));
    row.appendChild(chip);
  }
  container.appendChild(row);
}
```

- [ ] **Step 9: Add `_affixImpactCache` usage marker to suppress unused warning (temporary)**

Inside `renderMultiArc`, immediately after the chip row block, add a comment reference to `affixImpactCache` to suppress the unused-parameter error until Task 5:

Actually — just pass it through to the stub comparison view call you'll add in the next step. Leave the parameter in place; TypeScript will only error on `noUnusedParameters` if it's never referenced. Reference it in the `if (comparisonSeasonId !== null)` branch you'll add:

```ts
if (comparisonSeasonId !== null) {
  // comparison view — implemented in next task
  void affixImpactCache;
  return;
}
```

Add this block inside `renderMultiArc` after the chip row call but before the overview rendering code (the `const allSeasonRows: ArcEntry[] = [];` line).

- [ ] **Step 10: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no type errors.

- [ ] **Step 11: Commit**

```bash
git add src/charts/arc.ts
git commit -m "✨ Add season chip row to multi-dungeon arc panel"
```

---

## Task 4: Comparison view chart and leader ribbon

**Files:**
- Modify: `src/charts/arc.ts`

After this task, clicking a chip renders the focused comparison chart with N lines and the leader ribbon below the x-axis.

- [ ] **Step 1: Add `computeWeekLeaders` to the import**

Update the import from `arc-utils`:
```ts
import { computeAverageArc, collectAtWeek, computeSharedSeasons, computeWeekLeaders } from "../utils/arc-utils.js";
```

- [ ] **Step 2: Replace the stub `if (comparisonSeasonId !== null)` block**

Replace:
```ts
if (comparisonSeasonId !== null) {
  // comparison view — implemented in next task
  void affixImpactCache;
  return;
}
```
with:
```ts
if (comparisonSeasonId !== null) {
  renderComparisonView(container, dungeons, dungeonData, comparisonSeasonId, affixImpactCache);
  return;
}
```

- [ ] **Step 3: Add `renderComparisonView` function**

Add this function before `renderMultiArc` (you can place it after `renderSeasonChips`):

```ts
function renderComparisonView(
  container: HTMLElement,
  dungeons: DungeonMeta[],
  dungeonData: Map<number, ArcEntry[]>,
  comparisonSeasonId: number,
  affixImpactCache: Map<string, Map<number, { affixName: string; impactDelta: number }>>,
): void {
  const rowsByDungeon = new Map<number, WeeklyArcRow[]>();
  for (const dungeon of dungeons) {
    const entry = (dungeonData.get(dungeon.id) ?? []).find(
      e => e.season.id === comparisonSeasonId,
    );
    if (entry && entry.rows.length > 0) rowsByDungeon.set(dungeon.id, entry.rows);
  }
  if (rowsByDungeon.size === 0) return;

  const allRows = Array.from(rowsByDungeon.values()).flat();
  const maxPeriods = Math.max(...allRows.map(r => r.period_index));
  const RIBBON_H = 8;

  const width = container.clientWidth - MARGIN.left - MARGIN.right;
  const height = container.clientHeight - MARGIN.top - MARGIN.bottom - TITLE_H - CHIP_H;
  const chartHeight = height - RIBBON_H;

  const xScale = d3.scaleLinear().domain([1, maxPeriods]).range([0, width]);
  const yScale = d3.scaleLinear().domain(keyDomain).range([chartHeight, 0]);

  const lineGen = d3
    .line<WeeklyArcRow>()
    .x(r => xScale(r.period_index))
    .y(r => yScale(r.median_key))
    .curve(d3.curveMonotoneX);

  const svgHeight = container.clientHeight - TITLE_H - CHIP_H;
  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", container.clientWidth)
    .attr("height", svgHeight)
    .style("font-family", "sans-serif");

  const g = svg
    .append("g")
    .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

  drawAxes(g, xScale, yScale, chartHeight, width);

  for (let i = 0; i < dungeons.length; i++) {
    const dungeon = dungeons[i];
    const rows = rowsByDungeon.get(dungeon.id);
    if (!rows) continue;
    const color = dungeonColor(i);

    g.append("path")
      .datum(rows)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", 2.5)
      .attr("opacity", 1)
      .attr("d", lineGen);

    for (const row of rows) {
      g.append("circle")
        .attr("cx", xScale(row.period_index))
        .attr("cy", yScale(row.median_key))
        .attr("r", 3)
        .attr("fill", color)
        .style("pointer-events", "none");
    }
  }

  drawLeaderRibbon(g, dungeons, rowsByDungeon, xScale, chartHeight, RIBBON_H);
  drawComparisonTooltip(
    g,
    dungeons,
    rowsByDungeon,
    xScale,
    yScale,
    width,
    chartHeight,
    TITLE_H + CHIP_H,
    container,
    comparisonSeasonId,
    affixImpactCache,
  );
}
```

- [ ] **Step 4: Add `drawLeaderRibbon` function**

Add before `renderComparisonView`:

```ts
function drawLeaderRibbon(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  dungeons: DungeonMeta[],
  rowsByDungeon: Map<number, WeeklyArcRow[]>,
  xScale: d3.ScaleLinear<number, number>,
  yOffset: number,
  ribbonHeight: number,
): void {
  const leaders = computeWeekLeaders(
    dungeons,
    rowsByDungeon as Map<number, ReadonlyArray<{ period_index: number; median_key: number }>>,
  );
  if (leaders.size === 0) return;

  const domain = xScale.domain();
  const maxPeriods = Math.round(domain[1]);
  const halfStep = maxPeriods > 1 ? (xScale(2) - xScale(1)) / 2 : xScale(1) / 2;

  const ribbonG = g.append("g").attr("transform", `translate(0,${yOffset})`);

  for (const [period, leaderId] of leaders.entries()) {
    const dungeonIdx = dungeons.findIndex(d => d.id === leaderId);
    const color = dungeonIdx >= 0 ? dungeonColor(dungeonIdx) : "#3f3f46";
    ribbonG
      .append("rect")
      .attr("x", xScale(period) - halfStep)
      .attr("y", 0)
      .attr("width", halfStep * 2)
      .attr("height", ribbonHeight)
      .attr("fill", color)
      .attr("opacity", 0.85)
      .style("pointer-events", "none");
  }
}
```

- [ ] **Step 5: Add a stub `drawComparisonTooltip` to keep TypeScript happy**

Add before `drawLeaderRibbon`:

```ts
function drawComparisonTooltip(
  _g: d3.Selection<SVGGElement, unknown, null, undefined>,
  _dungeons: DungeonMeta[],
  _rowsByDungeon: Map<number, WeeklyArcRow[]>,
  _xScale: d3.ScaleLinear<number, number>,
  _yScale: d3.ScaleLinear<number, number>,
  _width: number,
  _height: number,
  _totalTitleH: number,
  _container: HTMLElement,
  _seasonId: number,
  _affixImpactCache: Map<string, Map<number, { affixName: string; impactDelta: number }>>,
): void {
  // implemented in next task
}
```

- [ ] **Step 6: Also update `renderMultiArc` title and height to account for `CHIP_H`**

Inside `renderMultiArc`, find the height calculation:
```ts
const height =
  container.clientHeight - MARGIN.top - MARGIN.bottom - totalTitleH;
```

The `totalTitleH` was `TITLE_H + LEGEND_H`. When chips are present, we also need to subtract `CHIP_H`. But since the chip row is only rendered when `sharedSeasons.length > 0`, and the comparison branch returns early, we only need to adjust the overview height when chips are visible.

Update the height calculation in `renderMultiArc` to:
```ts
const chipOffset = sharedSeasons.length > 0 ? CHIP_H : 0;
const height =
  container.clientHeight - MARGIN.top - MARGIN.bottom - totalTitleH - chipOffset;
```

And pass `totalTitleH + chipOffset` to `drawMultiDungeonTooltip`:
```ts
drawMultiDungeonTooltip(
  g,
  dungeons,
  avgRowsMap,
  xScale,
  yScale,
  width,
  height,
  totalTitleH + chipOffset,
  container,
);
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/charts/arc.ts
git commit -m "✨ Add comparison view with leader ribbon"
```

---

## Task 5: Async affix loading and comparison tooltip

**Files:**
- Modify: `src/charts/arc.ts`

After this task, clicking a chip loads affix impact data per dungeon and the tooltip shows the dungeon ranking, affix badges, and per-dungeon impact deltas.

- [ ] **Step 1: Make `onSelectSeason` async with affix loading**

Replace the current `onSelectSeason` definition:
```ts
const onSelectSeason = (seasonId: number | null): void => {
  comparisonSeasonId = seasonId;
  const currentState = getState();
  const selectedDungeons = currentState.selectedDungeons
    .map(id => manifest.dungeons.find(d => d.id === id))
    .filter((d): d is DungeonMeta => d !== undefined);
  const sharedSeasons = computeSharedSeasons(
    manifest.seasons,
    currentState.selectedDungeons,
    DISABLED_SEASONS,
    MAX_SEASON,
  );
  renderMultiArc(container, selectedDungeons, lastMultiData, sharedSeasons, comparisonSeasonId, onSelectSeason, affixImpactCache);
};
```
with:
```ts
const onSelectSeason = async (seasonId: number | null): Promise<void> => {
  comparisonSeasonId = seasonId;

  if (seasonId !== null) {
    const dungeonIds = getState().selectedDungeons;
    await Promise.all(
      dungeonIds.map(async (dungeonId) => {
        const cacheKey = `${dungeonId}:${seasonId}`;
        if (!affixImpactCache.has(cacheKey)) {
          const impacts = await getSecondaryAffixImpact(conn, dungeonId, seasonId);
          affixImpactCache.set(
            cacheKey,
            new Map(impacts.map(i => [i.affixId, { affixName: i.affixName, impactDelta: i.impactDelta }])),
          );
        }
      }),
    );
  }

  const currentState = getState();
  const selectedDungeons = currentState.selectedDungeons
    .map(id => manifest.dungeons.find(d => d.id === id))
    .filter((d): d is DungeonMeta => d !== undefined);
  const sharedSeasons = computeSharedSeasons(
    manifest.seasons,
    currentState.selectedDungeons,
    DISABLED_SEASONS,
    MAX_SEASON,
  );
  renderMultiArc(container, selectedDungeons, lastMultiData, sharedSeasons, comparisonSeasonId, onSelectSeason, affixImpactCache);
};
```

The chip's click handler calls `onSelectSeason` which returns a Promise. Update the event listener in `renderSeasonChips` to `void`-call it:

In `renderSeasonChips`, change:
```ts
chip.addEventListener("click", () => onSelect(isActive ? null : season.id));
```
to:
```ts
chip.addEventListener("click", () => { void onSelect(isActive ? null : season.id); });
```

And update the `onSelect` parameter type in `renderSeasonChips` from `(id: number | null) => void` to `(id: number | null) => void | Promise<void>`.

- [ ] **Step 2: Implement `drawComparisonTooltip`**

Replace the stub `drawComparisonTooltip` with the full implementation:

```ts
function drawComparisonTooltip(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  dungeons: DungeonMeta[],
  rowsByDungeon: Map<number, WeeklyArcRow[]>,
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  width: number,
  height: number,
  totalTitleH: number,
  container: HTMLElement,
  seasonId: number,
  affixImpactCache: Map<string, Map<number, { affixName: string; impactDelta: number }>>,
): void {
  const tooltipEl = document.createElement("div");
  tooltipEl.style.cssText =
    "position:absolute;background:#1c1c1f;border:1px solid #52525b;border-radius:6px;" +
    `padding:10px 13px;font-size:${FONT.small}px;color:#e4e4e7;line-height:1.7;` +
    "box-shadow:0 4px 16px rgba(0,0,0,0.5);pointer-events:none;display:none;" +
    "font-family:sans-serif;white-space:nowrap";
  container.appendChild(tooltipEl);

  const maxPeriods = Math.round(xScale.domain()[1]);
  const affixManifest = getAffixManifest();

  const hoverCircles = dungeons.map((_, i) =>
    g
      .append("circle")
      .attr("r", 0)
      .attr("fill", dungeonColor(i))
      .attr("stroke", "white")
      .attr("stroke-width", 1.5)
      .attr("opacity", 0.9)
      .style("pointer-events", "none"),
  );

  g.append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "none")
    .style("pointer-events", "all")
    .on("mousemove", (event: MouseEvent) => {
      const [mx, my] = d3.pointer(event);
      const periodIndex = Math.max(1, Math.min(Math.round(xScale.invert(mx)), maxPeriods));

      const dataPoints = dungeons
        .map((dungeon, i) => {
          const rows = rowsByDungeon.get(dungeon.id) ?? [];
          const row = rows.find(r => r.period_index === periodIndex);
          return row
            ? { dungeon, color: dungeonColor(i), key: row.median_key, period: row.period, i }
            : null;
        })
        .filter((d): d is NonNullable<typeof d> => d !== null)
        .sort((a, b) => b.key - a.key);

      hoverCircles.forEach((circle, i) => {
        const rows = rowsByDungeon.get(dungeons[i].id) ?? [];
        const row = rows.find(r => r.period_index === periodIndex);
        if (row) {
          circle.attr("cx", xScale(row.period_index)).attr("cy", yScale(row.median_key)).attr("r", 6);
        } else {
          circle.attr("r", 0);
        }
      });

      if (dataPoints.length === 0) {
        tooltipEl.style.display = "none";
        return;
      }

      const svgX = MARGIN.left + xScale(periodIndex);
      const cardW = 260;
      const left =
        svgX + cardW + TOOLTIP_OFFSET > container.clientWidth
          ? svgX - cardW - TOOLTIP_OFFSET
          : svgX + TOOLTIP_OFFSET;
      const containerY = totalTitleH + MARGIN.top + my;
      const top = Math.max(totalTitleH + 4, containerY - 60);

      tooltipEl.style.display = "block";
      tooltipEl.style.left = `${left}px`;
      tooltipEl.style.top = `${top}px`;

      const children: HTMLElement[] = [];

      // Header
      const weekEl = document.createElement("div");
      weekEl.style.cssText = `font-size:${FONT.small}px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#71717a;margin-bottom:6px`;
      weekEl.textContent = `Week ${periodIndex}`;
      children.push(weekEl);

      // Dungeon ranking grid
      const leader = dataPoints[0].key;
      const grid = document.createElement("div");
      grid.style.cssText =
        "display:grid;grid-template-columns:10px 1fr 54px;align-items:center;row-gap:3px;column-gap:6px;margin-bottom:8px";

      for (const { dungeon, color, key } of dataPoints) {
        const dot = document.createElement("span");
        dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;justify-self:center`;

        const nameEl = document.createElement("span");
        nameEl.style.cssText = `font-size:${FONT.small}px;color:#a1a1aa;overflow:hidden;text-overflow:ellipsis;white-space:nowrap`;
        nameEl.textContent = dungeon.name;

        const keyEl = document.createElement("span");
        keyEl.style.cssText = `font-size:${FONT.small}px;font-weight:700;color:${key === leader ? "#e4e4e7" : "#71717a"};text-align:right`;
        keyEl.textContent = `+${key.toFixed(2)}`;

        grid.appendChild(dot);
        grid.appendChild(nameEl);
        grid.appendChild(keyEl);
      }
      children.push(grid);

      // Affix section
      const rawPeriod = dataPoints[0].period;
      const weekAffixes = affixManifest[seasonId]?.[rawPeriod] ?? [];

      if (weekAffixes.length > 0) {
        const affixHeader = document.createElement("div");
        affixHeader.style.cssText = `font-size:${FONT.small}px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#71717a;margin-bottom:4px`;
        affixHeader.textContent = "Affixes";
        children.push(affixHeader);

        for (const affix of weekAffixes) {
          const isPrimary =
            affix.id === FORTIFIED_AFFIX_ID || affix.id === TYRANNICAL_AFFIX_ID;
          const affixBadgeColor = getAffixColor(affix.id);

          const affixRow = document.createElement("div");
          affixRow.style.cssText =
            "display:flex;align-items:baseline;gap:8px;margin-bottom:3px;flex-wrap:wrap;";

          const badgeEl = document.createElement("span");
          badgeEl.style.cssText = `font-size:${FONT.small}px;font-weight:600;color:${affixBadgeColor};flex-shrink:0;`;
          badgeEl.textContent = affix.name;
          affixRow.appendChild(badgeEl);

          if (!isPrimary) {
            for (let i = 0; i < dungeons.length; i++) {
              const dungeon = dungeons[i];
              const cacheKey = `${dungeon.id}:${seasonId}`;
              const impact = affixImpactCache.get(cacheKey)?.get(affix.id);
              if (impact === undefined) continue;

              const color = dungeonColor(i);
              const deltaStyle = cellStyle(impact.impactDelta);
              const sign = impact.impactDelta >= 0 ? "+" : "";

              const deltaEl = document.createElement("span");
              deltaEl.style.cssText = `font-size:${FONT.small}px;`;

              const abbrevSpan = document.createElement("span");
              abbrevSpan.style.color = color;
              abbrevSpan.textContent = dungeon.abbrev;

              const valueSpan = document.createElement("span");
              valueSpan.style.color = deltaStyle.bg;
              valueSpan.textContent = ` ${sign}${impact.impactDelta.toFixed(2)}`;

              deltaEl.appendChild(abbrevSpan);
              deltaEl.appendChild(valueSpan);
              affixRow.appendChild(deltaEl);
            }
          }

          children.push(affixRow);
        }
      }

      tooltipEl.replaceChildren(...children);
    })
    .on("mouseleave", () => {
      tooltipEl.style.display = "none";
      hoverCircles.forEach(c => c.attr("r", 0));
    });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no type errors.

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/charts/arc.ts
git commit -m "✨ Add comparison tooltip with affix data"
```
