# Dungeon Browser Search Bar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a search input to the dungeon browser that highlights matching dungeon tiles across all seasons while fading non-matches.

**Architecture:** Extract a pure `matchesDungeonSearch` utility for testability, then wire a search `<input>` into `dungeon-browser.ts` that drives a single `applyTileClasses()` function reconciling both search state and selection state. All changes are local to `dungeon-browser.ts` and `style.css` — no global state changes.

**Tech Stack:** TypeScript, Vitest, plain DOM APIs, CSS custom properties already defined in `style.css`.

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Create | `src/utils/dungeon-search.ts` | Pure `matchesDungeonSearch` function |
| Create | `src/utils/dungeon-search.test.ts` | Vitest unit tests |
| Modify | `src/style.css` | Search input styles + tooltip suppression class |
| Modify | `src/charts/dungeon-browser.ts` | Search input element, `applyTileClasses`, hover guards |

---

### Task 1: Pure search utility + tests

**Files:**
- Create: `src/utils/dungeon-search.ts`
- Create: `src/utils/dungeon-search.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/utils/dungeon-search.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { matchesDungeonSearch } from './dungeon-search.js';

describe('matchesDungeonSearch', () => {
  it('matches substring case-insensitively', () => {
    expect(matchesDungeonSearch('Deadmines', 'dead')).toBe(true);
    expect(matchesDungeonSearch('Deadmines', 'DEAD')).toBe(true);
  });

  it('returns false when query is not in name', () => {
    expect(matchesDungeonSearch('Deadmines', 'siege')).toBe(false);
  });

  it('matches full name exactly', () => {
    expect(matchesDungeonSearch('Siege of Boralus', 'Siege of Boralus')).toBe(true);
  });

  it('returns true when query is empty string', () => {
    expect(matchesDungeonSearch('Deadmines', '')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test -- --run src/utils/dungeon-search.test.ts
```

Expected: FAIL — `matchesDungeonSearch` not found.

- [ ] **Step 3: Implement the function**

Create `src/utils/dungeon-search.ts`:

```ts
export function matchesDungeonSearch(name: string, query: string): boolean {
  return name.toLowerCase().includes(query.toLowerCase());
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm run test -- --run src/utils/dungeon-search.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/dungeon-search.ts src/utils/dungeon-search.test.ts
git commit -m "✨ Add matchesDungeonSearch utility"
```

---

### Task 2: CSS for search input and tooltip suppression

**Files:**
- Modify: `src/style.css`

The existing dungeon-browser styles start at line 65. Insert the new block after the `.dungeon-browser-subtitle` rule (around line 78) and add a tooltip-suppression rule after `.tile-tooltip--below` (around line 184).

- [ ] **Step 1: Add search input styles after `.dungeon-browser-subtitle` block**

In `src/style.css`, after the closing `}` of `.dungeon-browser-subtitle` (line ~79), add:

```css
.dungeon-browser-search {
  display: block;
  width: calc(100% - 32px);
  margin: 0 16px 10px;
  padding: 6px 10px;
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 6px;
  color: #e4e4e7;
  font-size: var(--font-small);
  outline: none;
}

.dungeon-browser-search:focus {
  border-color: #71717a;
}
```

- [ ] **Step 2: Add tooltip suppression for when search is active**

In `src/style.css`, after the `.tile-tooltip--below` block (line ~184), add:

```css
.dungeon-browser--searching .tile:hover .tile-tooltip {
  display: none;
}
```

- [ ] **Step 3: Type-check (CSS has no compiler, just confirm build passes)**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/style.css
git commit -m "🎨 Add search input styles to dungeon browser"
```

---

### Task 3: Integrate search into dungeon-browser.ts

**Files:**
- Modify: `src/charts/dungeon-browser.ts`

This task makes all the wiring changes in one file. Read the full file before starting — it is ~213 lines.

- [ ] **Step 1: Add import for `matchesDungeonSearch`**

At the top of `src/charts/dungeon-browser.ts`, add to the existing imports:

```ts
import { matchesDungeonSearch } from '../utils/dungeon-search.js';
```

- [ ] **Step 2: Store `dungeon.name` on each tile element**

In the tile-building loop (around line 120, right after `tile.dataset.dungeonId = String(dungeon.id)`), add:

```ts
tile.dataset.dungeonName = dungeon.name;
```

- [ ] **Step 3: Remove the per-tile initial selection block**

Delete these lines (around 147–152) — `applyTileClasses()` (added in step 5) will handle the initial state after all tiles are built:

```ts
        // Apply initial selection state
        const currentState = getState();
        const isSelected = currentState.selectedDungeons.includes(dungeon.id);
        if (isSelected) {
          tile.classList.add('tile--selected');
        }
```

- [ ] **Step 4: Guard hover handlers against active search**

Replace the existing `mouseenter`/`mouseleave` listeners (lines ~138–144):

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
```

Note: `searchQuery` is declared in step 6. Because the handlers only execute after user interaction (not at declaration time), forward-referencing it here is fine in JS/TS closures.

- [ ] **Step 5: Add `searchQuery` closure variable and `applyTileClasses` function**

Insert both right before the `subscribe(...)` call near the bottom of `initDungeonBrowser`. After the lanes loop and legend, and before the `subscribe` call:

```ts
  let searchQuery = '';

  function applyTileClasses(): void {
    const currentState = getState();
    const hasSelection = currentState.selectedDungeons.length > 0;
    const hasSearch = searchQuery.length > 0;

    container.querySelectorAll<HTMLElement>('.tile').forEach((tile) => {
      const dungeonId = Number(tile.dataset.dungeonId);
      const dungeonName = tile.dataset.dungeonName ?? '';
      const isSelected = currentState.selectedDungeons.includes(dungeonId);
      const isSearchMatch = hasSearch && matchesDungeonSearch(dungeonName, searchQuery);

      tile.classList.toggle('tile--selected', isSelected);
      tile.classList.toggle('tile--highlighted', !isSelected && isSearchMatch);
      tile.classList.toggle('tile--faded', !isSelected && ((hasSearch && !isSearchMatch) || (!hasSearch && hasSelection)));
    });
  }
```

- [ ] **Step 6: Refactor the `subscribe` callback to use `applyTileClasses`**

Replace the existing `subscribe(...)` block with:

```ts
  subscribe((state) => {
    const hasSelection = state.selectedDungeons.length > 0;

    subtitleEl.textContent = hasSelection
      ? `${state.selectedDungeons.length} / 4 selected · Left tile = highest median key level`
      : 'Oldest season at top · Left tile = highest median key level';

    applyTileClasses();
  });
```

- [ ] **Step 7: Add search input element and wire input event**

Insert these lines right after `container.appendChild(subtitleEl)` (and before `container.appendChild(lanesEl)`):

```ts
  const searchEl = document.createElement('input');
  searchEl.type = 'search';
  searchEl.placeholder = 'Search dungeons…';
  searchEl.className = 'dungeon-browser-search';
  searchEl.addEventListener('input', () => {
    searchQuery = searchEl.value.trim();
    container.classList.toggle('dungeon-browser--searching', searchQuery.length > 0);
    applyTileClasses();
  });
  container.appendChild(searchEl);
```

- [ ] **Step 8: Call `applyTileClasses` once after all lanes are built**

After the lanes+legend building loop (after `container.appendChild(legendEl)`), add:

```ts
  applyTileClasses();
```

This replaces the per-tile initial selection block removed in step 3.

- [ ] **Step 9: Type-check**

```bash
npm run build
```

Expected: build succeeds with zero TypeScript errors. Fix any `noUnusedLocals` / `noUnusedParameters` errors before proceeding.

- [ ] **Step 10: Run full test suite**

```bash
npm run test -- --run
```

Expected: all tests pass (including the new `dungeon-search` tests).

- [ ] **Step 11: Commit**

```bash
git add src/charts/dungeon-browser.ts
git commit -m "✨ Dungeon browser: add search bar with highlight"
```
