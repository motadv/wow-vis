# Pre-Season 13 Season Cap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cap the entire application at Season 12, excluding all Season 13+ data and dungeons from every view, and remove the dead War Within workaround code that was previously patching this problem.

**Architecture:** A single `MAX_SEASON = 12` constant in `src/config.ts` is imported by every chart that filters seasons or dungeons. Dead War Within branches in `getPrimaryAffixTrend()` and `renderStreamGraph()` are deleted. No new abstractions are introduced.

**Tech Stack:** TypeScript, D3.js, DuckDB-Wasm, Vite. Run `npm run test` (Vitest) for unit tests and `npm run build` (tsc + vite) for type checking.

---

## File Map

| File | Change |
|------|--------|
| `src/config.ts` | Add `export const MAX_SEASON = 12` |
| `src/charts/init.ts` | Filter `seasonIds` for `getGlobalKeyRange` to `<= MAX_SEASON` |
| `src/charts/dungeon-browser.ts` | Filter seasons and dungeon list to pre-S13 |
| `src/charts/arc.ts` | Filter active seasons per dungeon to `<= MAX_SEASON` |
| `src/charts/map.ts` | Filter dungeon nodes to those active in at least one pre-S13 season |
| `src/charts/affix.ts` | Keep all dungeon seasons in selector; disable S13+ buttons; cap effective season for queries |
| `src/db/queries.ts` | Remove `isWarWithin` branch from `getPrimaryAffixTrend()` |
| `src/charts/affix-stream.ts` | Remove `isWarWithin` detection and `combinedMedian` path from `renderStreamGraph()` |

---

## Task 1: Add MAX_SEASON constant and cap init.ts

**Files:**
- Modify: `src/config.ts`
- Modify: `src/charts/init.ts`

- [ ] **Step 1: Add the constant**

In `src/config.ts`, add after the existing constants (e.g., after `OFF_WORLD_Y`):

```typescript
export const MAX_SEASON = 12;
```

- [ ] **Step 2: Cap seasonIds in init.ts**

In `src/charts/init.ts`, add `MAX_SEASON` to the import from `../config.js` and update the `seasonIds` line (currently line 21):

```typescript
// Before:
const seasonIds = manifest.seasons.filter(s => s.dungeonIds.length > 0).map(s => s.id);

// After:
const seasonIds = manifest.seasons
  .filter(s => s.dungeonIds.length > 0 && s.id <= MAX_SEASON)
  .map(s => s.id);
```

- [ ] **Step 3: Run tests and type-check**

```bash
npm run test
npm run build
```

Expected: all 11 tests pass, zero TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/config.ts src/charts/init.ts
git commit -m "✨ Add MAX_SEASON cap and filter global key range to pre-S13"
```

---

## Task 2: Filter dungeon-browser to pre-S13 seasons and dungeons

**Files:**
- Modify: `src/charts/dungeon-browser.ts`

- [ ] **Step 1: Add import and filter seasons**

Add `MAX_SEASON` to the import from `../config.js` (already imports `ERA_PALETTE`, `ERA_LABELS`, `ERAS_IN_ORDER`).

In `initDungeonBrowser`, update the `seasons` derivation (currently line 20–22):

```typescript
// Before:
const seasons = manifest.seasons
  .filter((s) => s.dungeonIds.length > 0)
  .sort((a, b) => a.id - b.id);

// After:
const seasons = manifest.seasons
  .filter((s) => s.dungeonIds.length > 0 && s.id <= MAX_SEASON)
  .sort((a, b) => a.id - b.id);
```

- [ ] **Step 2: Filter the dungeon list**

After deriving `seasons`, compute the set of valid dungeon IDs and filter `manifest.dungeons` to that set. Add these lines before the `container.textContent = 'Loading…'` line:

```typescript
const validDungeonIds = new Set(seasons.flatMap(s => s.dungeonIds));
const dungeons = manifest.dungeons.filter(d => validDungeonIds.has(d.id));
```

Then replace the two `manifest.dungeons` references inside this function:

- In the tile rendering loop: `manifest.dungeons.find((d) => d.id === r.dungeon_id)` → `dungeons.find((d) => d.id === r.dungeon_id)`
- In the era legend: `manifest.dungeons.some((d) => d.era === era)` → `dungeons.some((d) => d.era === era)`

- [ ] **Step 3: Run tests and type-check**

```bash
npm run test
npm run build
```

Expected: all 11 tests pass, zero TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/charts/dungeon-browser.ts
git commit -m "✂️ Filter dungeon browser to pre-S13 seasons and dungeons"
```

---

## Task 3: Filter arc chart to pre-S13 seasons

**Files:**
- Modify: `src/charts/arc.ts`

- [ ] **Step 1: Add import and filter active seasons**

Add `MAX_SEASON` to the import from `../config.js`.

In the `subscribe` callback inside `initArc`, update `activeSeasonsForDungeon` (currently line 43–44):

```typescript
// Before:
const activeSeasonsForDungeon = manifest.seasons
  .filter(s => s.dungeonIds.includes(dungeonAtStart))
  .sort((a, b) => a.id - b.id);

// After:
const activeSeasonsForDungeon = manifest.seasons
  .filter(s => s.dungeonIds.includes(dungeonAtStart) && s.id <= MAX_SEASON)
  .sort((a, b) => a.id - b.id);
```

- [ ] **Step 2: Run tests and type-check**

```bash
npm run test
npm run build
```

Expected: all 11 tests pass, zero TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/charts/arc.ts
git commit -m "✂️ Filter arc chart lines to pre-S13 seasons"
```

---

## Task 4: Filter map dungeon nodes to pre-S13 dungeons

**Files:**
- Modify: `src/charts/map.ts`

- [ ] **Step 1: Add import and derive valid dungeon set**

Add `MAX_SEASON` to the import from `../config.js` (already imports `MAP_WIDTH`, `MAP_HEIGHT`, `OFF_WORLD_X`, `OFF_WORLD_Y`, `ERA_PALETTE`).

`map.ts` uses a module-level `manifest` variable shared between `buildPositions()` and `renderNodes()`. Add a parallel module-level variable for the filtered list:

```typescript
let activeDungeons: DungeonMeta[] = [];
```

In `initMap`, after `manifest = mf`, compute `activeDungeons`:

```typescript
const validDungeonIds = new Set(
  mf.seasons
    .filter(s => s.id <= MAX_SEASON && s.dungeonIds.length > 0)
    .flatMap(s => s.dungeonIds)
);
activeDungeons = mf.dungeons.filter(d => validDungeonIds.has(d.id));
```

Then substitute `activeDungeons` for `manifest.dungeons` in two places:
- `buildPositions()`: replace `manifest.dungeons` (used to group by zone and off-world) with `activeDungeons`
- `renderNodes()`: replace `.data(manifest.dungeons, (d) => d.id)` with `.data(activeDungeons, (d) => d.id)`

- [ ] **Step 2: Run tests and type-check**

```bash
npm run test
npm run build
```

Expected: all 11 tests pass, zero TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/charts/map.ts
git commit -m "✂️ Filter map dungeon nodes to pre-S13 dungeons"
```

---

## Task 5: Update affix panel season selector for S13+ disabled buttons

**Files:**
- Modify: `src/charts/affix.ts`

- [ ] **Step 1: Add import**

Add `MAX_SEASON` to the import from `../config.js`.

- [ ] **Step 2: Update `getAvailableSeasonsForDungeons` — do NOT filter by MAX_SEASON here**

This function must return all seasons the dungeon was active in (including S13+) so the selector can render them as disabled. Leave the function body unchanged.

- [ ] **Step 3: Update `renderSeasonSelector` to disable S13+ buttons**

In `renderSeasonSelector`, in the loop that renders season buttons, add a disabled branch for `seasonId > MAX_SEASON`:

```typescript
for (const seasonId of availableSeasons) {
  const btn = document.createElement('button');
  btn.textContent = `S${seasonId}`;

  if (seasonId > MAX_SEASON) {
    // Disabled — War Within season, no affix data
    btn.disabled = true;
    btn.title = 'Affix analysis not available for War Within seasons';
    btn.style.cssText = `
      padding:6px 12px;
      font-size:12px;
      border:1px solid #303030;
      background:transparent;
      color:#444;
      border-radius:4px;
      cursor:not-allowed;
      opacity:0.4;
      font-weight:600;
    `;
    buttonGroup.appendChild(btn);
    continue;
  }

  // existing enabled button code unchanged below ...
```

- [ ] **Step 4: Cap effective season for queries**

In `initAffixChart`'s `subscribe` callback, after computing `effectiveSeasonId`, add a cap:

```typescript
// After the existing effectiveSeasonId fallback logic, add:
if (effectiveSeasonId && effectiveSeasonId > MAX_SEASON) {
  // Find most recent pre-S13 season available for this dungeon
  effectiveSeasonId = availableSeasons.filter(s => s <= MAX_SEASON)[0] ?? null;
}
```

Also update the "default to most recent available" fallback in both `renderSingleDungeonView` and `renderMultiDungeonView`: when `seasonId` is null, pick from `availableSeasons.filter(s => s <= MAX_SEASON)` rather than `availableSeasons`.

- [ ] **Step 5: Run tests and type-check**

```bash
npm run test
npm run build
```

Expected: all 11 tests pass, zero TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/charts/affix.ts
git commit -m "✂️ Disable S13+ season buttons in affix panel, cap effective season"
```

---

## Task 6: Remove War Within branch from getPrimaryAffixTrend

**Files:**
- Modify: `src/db/queries.ts`

- [ ] **Step 1: Delete the isWarWithin branch**

In `getPrimaryAffixTrend()`, delete:
- The `const isWarWithin = seasonId >= 13;` line
- The entire `if (isWarWithin) { ... }` block (including the combined-median query and the `return` inside it)
- The `// Pre-War Within logic:` comment that preceded the remaining code (now just "the" code)

The function body should contain only the pre-S13 split-by-`fortified` query. The return type `Array<{ period, fortifiedMedian, tyrannicalMedian }>` is unchanged.

- [ ] **Step 2: Run tests and type-check**

```bash
npm run test
npm run build
```

Expected: all 11 tests pass, zero TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/db/queries.ts
git commit -m "🗑️ Remove War Within branch from getPrimaryAffixTrend"
```

---

## Task 7: Remove War Within path from renderStreamGraph

**Files:**
- Modify: `src/charts/affix-stream.ts`

- [ ] **Step 1: Delete the isWarWithin detection and single-line path**

In `renderStreamGraph()`, delete:
- The `const isWarWithin = data.some(d => 'combinedMedian' in d && ...)` line
- The entire `if (isWarWithin) { ... }` block (single purple line, combined-median scale, war-within `legendInfo`)
- The `} else {` / closing `}` that wraps the pre-S13 stacked area code — promote that code to the top level

The function should now unconditionally render the stacked area chart (blue Fortified + orange Tyrannical). Variables `yScale`, `line`, and `legendInfo` that were previously declared with `let` inside branches can become `const` assignments.

- [ ] **Step 2: Run tests and type-check**

```bash
npm run test
npm run build
```

Expected: all 11 tests pass, zero TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/charts/affix-stream.ts
git commit -m "🗑️ Remove War Within single-line path from stream graph"
```

---

## Task 8: Visual verification in browser

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify dungeon browser**

Open the app. Confirm the dungeon browser shows no Season 13, 14, or 15 swim lanes. Confirm no War Within-only dungeons appear in the list.

- [ ] **Step 3: Verify map**

Confirm no War Within-only dungeon nodes appear on the world map.

- [ ] **Step 4: Verify arc chart**

Select a dungeon that appeared in both pre-S13 and S13+ seasons (e.g., a dungeon active in S8 and S13). Confirm the arc chart shows lines only up to S12.

- [ ] **Step 5: Verify affix panel — pre-S13 dungeon**

Select a dungeon active in pre-S13 seasons. Confirm the season selector shows S13/S14/S15 buttons grayed out (if those seasons exist for that dungeon) with correct tooltip on hover. Confirm the stream graph renders the Fortified/Tyrannical stacked area (not the purple single line). Confirm the radial chart renders normally.

- [ ] **Step 6: Verify affix panel — "All" button**

With a multi-season dungeon selected, click "All". Confirm the effective season defaults to the most recent pre-S13 season (not S13+).

- [ ] **Step 7: Final commit if any fixups were needed**

```bash
git add -p  # stage any browser-driven fixups
git commit -m "🐛 Fix visual issues found during browser verification"
```
