# Disabled Seasons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exclude S5 and S9 data from all charts while keeping their rows visible but greyed out in the dungeon browser.

**Architecture:** A single `DISABLED_SEASONS` constant in `src/config.ts` drives everything. Chart filter expressions gain one additional predicate. The dungeon browser renders disabled-season lanes and tiles with CSS classes that disable interaction and apply a greyscale/opacity style.

**Tech Stack:** TypeScript, D3.js, plain CSS

---

### Task 1: Add DISABLED_SEASONS to config

**Files:**
- Modify: `src/config.ts`

- [ ] **Step 1: Add the constant after MAX_SEASON**

In `src/config.ts`, after the line `export const MAX_SEASON = 12;`, add:

```ts
export const DISABLED_SEASONS = new Set([5, 9]);
```

- [ ] **Step 2: Type-check**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/config.ts
git commit -m "✨ Add DISABLED_SEASONS constant"
```

---

### Task 2: Filter disabled seasons from arc chart

**Files:**
- Modify: `src/charts/arc.ts`

The arc chart has two separate filter expressions that build the active-seasons list for a dungeon. Both need the same additional predicate.

- [ ] **Step 1: Update first filter (line ~83)**

Find this expression:
```ts
(s) => s.dungeonIds.includes(dungeonId) && s.id <= MAX_SEASON,
```
Change to:
```ts
(s) => s.dungeonIds.includes(dungeonId) && s.id <= MAX_SEASON && !DISABLED_SEASONS.has(s.id),
```

- [ ] **Step 2: Update second filter (line ~124)**

Find this expression:
```ts
.filter((s) => s.dungeonIds.includes(dungeonId) && s.id <= MAX_SEASON)
```
Change to:
```ts
.filter((s) => s.dungeonIds.includes(dungeonId) && s.id <= MAX_SEASON && !DISABLED_SEASONS.has(s.id))
```

- [ ] **Step 3: Update import in arc.ts**

Find the import from `../config.js` (or `"../config.js"`). Add `DISABLED_SEASONS` to it:
```ts
import { MAX_SEASON, DISABLED_SEASONS } from "../config.js";
```

- [ ] **Step 4: Type-check**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/charts/arc.ts
git commit -m "✨ Exclude disabled seasons from arc chart"
```

---

### Task 3: Filter disabled seasons from affix chart

**Files:**
- Modify: `src/charts/affix.ts`

- [ ] **Step 1: Update the availableSeasons filter (line ~60)**

Find:
```ts
.filter(s => s.dungeonIds.includes(dungeonId) && s.id <= MAX_SEASON)
```
Change to:
```ts
.filter(s => s.dungeonIds.includes(dungeonId) && s.id <= MAX_SEASON && !DISABLED_SEASONS.has(s.id))
```

- [ ] **Step 2: Update import in affix.ts**

Find the import from `'../config.js'`. Add `DISABLED_SEASONS`:
```ts
import { MAX_SEASON, DISABLED_SEASONS } from '../config.js';
```

- [ ] **Step 3: Type-check**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/charts/affix.ts
git commit -m "✨ Exclude disabled seasons from affix chart"
```

---

### Task 4: Mark disabled lanes and tiles in dungeon browser

**Files:**
- Modify: `src/charts/dungeon-browser.ts`

Disabled season lanes still appear in the browser (they are not filtered out), but the lane element gets `lane--disabled` and each tile gets `tile--disabled` with no click or hover handlers attached.

- [ ] **Step 1: Update import in dungeon-browser.ts**

Find the import from `'../config.js'`. Add `DISABLED_SEASONS`:
```ts
import { ERA_PALETTE, ERA_LABELS, ERAS_IN_ORDER, MAX_SEASON, DISABLED_SEASONS } from '../config.js';
```

- [ ] **Step 2: Mark disabled lanes**

Find this block (line ~96–98):
```ts
const lane = document.createElement('div');
lane.className = 'lane';
lane.dataset.seasonId = String(season.id);
```
Change to:
```ts
const lane = document.createElement('div');
const isDisabled = DISABLED_SEASONS.has(season.id);
lane.className = isDisabled ? 'lane lane--disabled' : 'lane';
lane.dataset.seasonId = String(season.id);
```

- [ ] **Step 3: Mark tiles and skip handlers for disabled seasons**

Find this block inside the tile-creation loop (line ~130–162):
```ts
const tile = document.createElement('div');
tile.className = 'tile';
tile.dataset.dungeonId = String(dungeon.id);
tile.dataset.dungeonName = dungeon.name;
tile.style.background = ERA_PALETTE[dungeon.era];
tile.style.cursor = 'pointer';
tile.textContent = dungeon.abbrev;
```
Change to:
```ts
const tile = document.createElement('div');
tile.className = isDisabled ? 'tile tile--disabled' : 'tile';
tile.dataset.dungeonId = String(dungeon.id);
tile.dataset.dungeonName = dungeon.name;
tile.style.background = ERA_PALETTE[dungeon.era];
tile.style.cursor = isDisabled ? 'default' : 'pointer';
tile.textContent = dungeon.abbrev;
```

Then find the event listener + click block that follows (line ~151–162):
```ts
tile.addEventListener('mouseenter', () => {
  if (searchQuery.length > 0) return;
  applyHighlight(dungeon.id);
  const rect = tile.getBoundingClientRect();
  const tooltipHeight = 100; // conservative estimate before it's visible
  tooltip.classList.toggle('tile-tooltip--below', rect.top < tooltipHeight + 16);
});
tile.addEventListener('mouseleave', () => {
  if (searchQuery.length > 0) return;
  clearHighlight();
});
tile.onclick = (e) => handleTileClick(dungeon.id, e as MouseEvent);
```
Wrap the whole block in a guard:
```ts
if (!isDisabled) {
  tile.addEventListener('mouseenter', () => {
    if (searchQuery.length > 0) return;
    applyHighlight(dungeon.id);
    const rect = tile.getBoundingClientRect();
    const tooltipHeight = 100;
    tooltip.classList.toggle('tile-tooltip--below', rect.top < tooltipHeight + 16);
  });
  tile.addEventListener('mouseleave', () => {
    if (searchQuery.length > 0) return;
    clearHighlight();
  });
  tile.onclick = (e) => handleTileClick(dungeon.id, e as MouseEvent);
}
```

- [ ] **Step 4: Type-check**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/charts/dungeon-browser.ts
git commit -m "✨ Grey out disabled season lanes in dungeon browser"
```

---

### Task 5: Add CSS for disabled state

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: Add disabled CSS rules after the .lane--faded block**

Find this block in `src/style.css`:
```css
.lane--faded .tile {
  opacity: 0.15;
}
```
After it, add:
```css
.lane--disabled .lane-label {
  opacity: 0.45;
}

.tile--disabled {
  pointer-events: none;
  filter: grayscale(1) opacity(0.45);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/style.css
git commit -m "🎨 Add disabled lane and tile styles"
```

---

### Task 6: Verify in browser

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open the app and check**

1. Season rows for S5 and S9 should appear in the dungeon browser but with their tiles greyed out and desaturated.
2. Hovering over S5/S9 tiles should produce no highlight and no tooltip.
3. Clicking S5/S9 tiles should have no effect.
4. Selecting a dungeon that appeared in S5 or S9 (most dungeons did) should render the arc chart with no line for S5 or S9.
5. The affix panel should not list S5 or S9 in any season dropdown.
