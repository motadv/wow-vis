# Dungeon Ranking Expansion Group Headers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group the dungeon ranking heatmap lanes by expansion, with a full expansion name heading above each group and "Season N" labels on individual lanes.

**Architecture:** Extract two pure string-parsing helpers (`expansionName`, `seasonLabel`) into `src/utils/seasons.ts`, test them in isolation, then update `heatmap.ts` to group seasons by expansion and emit `.expansion-header` elements, and update `style.css` with the new class and a wider lane label.

**Tech Stack:** TypeScript, D3-free DOM manipulation, Vitest for unit tests, plain CSS.

---

## File Map

- **Create:** `src/utils/seasons.ts` — `expansionName()` and `seasonLabel()` helpers
- **Create:** `src/utils/seasons.test.ts` — unit tests for the helpers
- **Modify:** `src/charts/heatmap.ts` — import helpers, group by expansion, render headers, remove `seasonAbbrev`
- **Modify:** `src/style.css` — add `.expansion-header` class, widen `.lane-label`

---

### Task 1: Extract season label helpers with tests (TDD)

**Files:**
- Create: `src/utils/seasons.ts`
- Create: `src/utils/seasons.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/seasons.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { expansionName, seasonLabel } from './seasons.js';
import type { SeasonMeta } from '../types.js';

function season(id: number, name: string): SeasonMeta {
  return { id, name, startTimestamp: 0, dungeonIds: [] };
}

describe('expansionName', () => {
  it('extracts expansion from a valid season name', () => {
    expect(expansionName(season(5, 'Mythic+ Dungeons (Shadowlands Season 1)'))).toBe('Shadowlands');
    expect(expansionName(season(9, 'Mythic+ Dungeons (Dragonflight Season 1)'))).toBe('Dragonflight');
    expect(expansionName(season(13, 'Mythic+ Dungeons (The War Within Season 1)'))).toBe('The War Within');
  });

  it('returns null for an unparseable season name', () => {
    expect(expansionName(season(1, 'Season 1'))).toBeNull();
  });
});

describe('seasonLabel', () => {
  it('extracts the season number from a valid season name', () => {
    expect(seasonLabel(season(9, 'Mythic+ Dungeons (Dragonflight Season 1)'))).toBe('Season 1');
    expect(seasonLabel(season(12, 'Mythic+ Dungeons (Dragonflight Season 4)'))).toBe('Season 4');
    expect(seasonLabel(season(14, 'Mythic+ Dungeons (The War Within Season 2)'))).toBe('Season 2');
  });

  it('falls back to S{id} for unparseable name', () => {
    expect(seasonLabel(season(1, 'Season 1'))).toBe('S1');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- seasons
```

Expected: both `expansionName` and `seasonLabel` tests fail with "Cannot find module './seasons.js'".

- [ ] **Step 3: Implement the helpers**

Create `src/utils/seasons.ts`:

```typescript
import type { SeasonMeta } from '../types.js';

export function expansionName(season: SeasonMeta): string | null {
  const m = season.name.match(/\((.+?) Season \d+\)/);
  return m ? m[1] : null;
}

export function seasonLabel(season: SeasonMeta): string {
  const m = season.name.match(/Season (\d+)\)/);
  return m ? `Season ${m[1]}` : `S${season.id}`;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test -- seasons
```

Expected: 4 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add src/utils/seasons.ts src/utils/seasons.test.ts
git commit -m "✨ Add expansionName/seasonLabel helpers"
```

---

### Task 2: Update heatmap rendering to group by expansion

**Files:**
- Modify: `src/charts/heatmap.ts`

- [ ] **Step 1: Replace the import and grouping logic**

At the top of `heatmap.ts`, add the import after the existing imports:

```typescript
import { expansionName, seasonLabel } from '../utils/seasons.js';
```

Replace the existing `for (const season of seasons)` render loop (lines 54–104) and the preceding `lanesEl` construction with the following. Keep everything above `lanesEl` (title, subtitle) and below (legend, subscribe) unchanged:

```typescript
  // Group seasons by expansion, preserving chronological order
  const grouped = new Map<string, SeasonMeta[]>();
  for (const season of seasons) {
    const exp = expansionName(season);
    if (exp === null) continue;
    if (!grouped.has(exp)) grouped.set(exp, []);
    grouped.get(exp)!.push(season);
  }

  let firstGroup = true;
  for (const [expansion, expSeasons] of grouped) {
    const headerEl = document.createElement('div');
    headerEl.className = firstGroup
      ? 'expansion-header expansion-header--first'
      : 'expansion-header';
    headerEl.textContent = expansion;
    lanesEl.appendChild(headerEl);
    firstGroup = false;

    for (const season of expSeasons) {
      const entries = bySeason.get(season.id) ?? [];

      const lane = document.createElement('div');
      lane.className = 'lane';
      lane.dataset.seasonId = String(season.id);

      const labelEl = document.createElement('div');
      labelEl.className = 'lane-label';
      labelEl.textContent = seasonLabel(season);
      lane.appendChild(labelEl);

      const tilesEl = document.createElement('div');
      tilesEl.className = 'lane-tiles';

      for (const r of entries) {
        const dungeon = manifest.dungeons.find((d) => d.id === r.dungeon_id);
        if (!dungeon) continue;

        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.dataset.dungeonId = String(dungeon.id);
        tile.style.background = ERA_PALETTE[dungeon.era];
        tile.textContent = dungeon.abbrev;

        const tooltip = document.createElement('div');
        tooltip.className = 'tile-tooltip';
        const nameStrong = document.createElement('strong');
        nameStrong.textContent = dungeon.name;
        tooltip.appendChild(nameStrong);
        tooltip.appendChild(document.createElement('br'));
        tooltip.appendChild(document.createTextNode(`${expansion} · ${seasonLabel(season)}`));
        tooltip.appendChild(document.createElement('br'));
        tooltip.appendChild(document.createTextNode(`Median key: +${r.median_key.toFixed(1)}`));
        tooltip.appendChild(document.createElement('br'));
        tooltip.appendChild(document.createTextNode(`Rank ${r.rank} of ${r.total}`));
        tile.appendChild(tooltip);

        tile.addEventListener('mouseenter', () => applyHighlight(dungeon.id));
        tile.addEventListener('mouseleave', clearHighlight);
        tile.addEventListener('click', () =>
          setState({ selectedDungeon: dungeon.id, selectedSeasonForArc: season.id }),
        );

        tilesEl.appendChild(tile);
      }

      lane.appendChild(tilesEl);
      lanesEl.appendChild(lane);
    }
  }
```

- [ ] **Step 2: Remove the `seasonAbbrev` function**

Delete the `seasonAbbrev` function at the bottom of the file (lines 154–163 in the original):

```typescript
function seasonAbbrev(season: SeasonMeta): string {
  const m = season.name.match(/\((.+?) Season (\d+)\)/);
  if (!m) return `S${season.id}`;
  const expansions: Record<string, string> = {
    Shadowlands: 'SL',
    Dragonflight: 'DF',
    'The War Within': 'TWW',
  };
  return `${expansions[m[1]] ?? m[1]} S${m[2]}`;
}
```

- [ ] **Step 3: Verify type-check passes**

```bash
npm run build
```

Expected: no TypeScript errors, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/charts/heatmap.ts
git commit -m "♻️ Group heatmap lanes by expansion with section headers"
```

---

### Task 3: Update CSS for expansion headers and lane labels

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: Add `.expansion-header` styles**

After the `.heatmap-lanes` block (after line 55), insert:

```css
.expansion-header {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #52525b;
  padding: 14px 0 4px;
  border-top: 1px solid #27272a;
  margin-top: 8px;
}

.expansion-header--first {
  border-top: none;
  margin-top: 0;
  padding-top: 4px;
}
```

- [ ] **Step 2: Widen `.lane-label`**

In the `.lane-label` block, change `width: 52px` to `width: 68px`:

```css
.lane-label {
  font-size: 11px;
  color: #71717a;
  width: 68px;
  text-align: right;
  flex-shrink: 0;
  white-space: nowrap;
}
```

- [ ] **Step 3: Verify visually**

```bash
npm run dev
```

Open the app. Confirm:
- Three expansion headings appear: "Shadowlands", "Dragonflight", "The War Within"
- Each heading has a top border separator (except the first)
- Lane labels read "Season 1", "Season 2", etc.
- Tile hover, highlight, and click-to-select behavior is unchanged
- Tile tooltip shows expansion and season name instead of the old short form

- [ ] **Step 4: Commit**

```bash
git add src/style.css
git commit -m "💄 Style expansion group headers in heatmap"
```
