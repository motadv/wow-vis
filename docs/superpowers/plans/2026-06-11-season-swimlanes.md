# Season Swimlanes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sparse dungeon×season matrix heatmap with season swimlanes — one row per season, dungeon tiles ranked left→right by median key, with cross-lane hover highlight and click-to-select driving the arc chart.

**Architecture:** Plain DOM (no SVG) for the swimlane; era color from the existing `ERA_PALETTE`; D3 dropped from heatmap.ts entirely. Layout reorganised so `#heatmap` is the left primary column and `#arc` is the right column; `#map` stays in the DOM but hidden.

**Tech Stack:** TypeScript, D3 (arc chart only), DuckDB-Wasm, Vite

---

## File Map

| Action | File |
|--------|------|
| Modify | `src/types.ts` — add `abbrev` to `DungeonMeta` |
| Modify | `scripts/fetch/types.ts` — keep in sync |
| Modify | `public/data/dungeons.json` — add `abbrev` to all 49 entries |
| Modify | `index.html` — remove `#left` wrapper; reorder `#heatmap` before `#arc` |
| Modify | `src/style.css` — hide `#map`; new layout + swimlane styles |
| Rewrite | `src/charts/heatmap.ts` — swimlane renderer replacing SVG matrix |

---

## Task 1: Add `abbrev` field to DungeonMeta

**Files:**
- Modify: `src/types.ts`
- Modify: `scripts/fetch/types.ts`

- [ ] **Step 1: Add `abbrev` to `src/types.ts`**

```typescript
export interface DungeonMeta {
  id: number;
  name: string;
  abbrev: string;    // ← add this line
  era: Era;
  zone: string;
  offWorld: boolean;
}
```

- [ ] **Step 2: Add `abbrev` to `scripts/fetch/types.ts`**

```typescript
export interface DungeonMeta {
  id: number;        // map_challenge_mode_id
  name: string;
  abbrev: string;    // ← add this line
  era: Era;          // expansion of origin
  zone: string;      // overworld zone slug — matches ZoneMeta.slug
  offWorld: boolean; // true = off-world dungeon, render in off-world cluster
}
```

- [ ] **Step 3: Verify TypeScript catches the missing field**

Run:
```bash
npm run build
```

Expected: type errors on every dungeon object literal in `dungeons.json` that is missing `abbrev`. (These will be fixed in Task 2.)

- [ ] **Step 4: Commit**

```bash
git add src/types.ts scripts/fetch/types.ts
git commit -m "✨ Add abbrev field to DungeonMeta"
```

---

## Task 2: Annotate dungeons.json with abbreviations

**Files:**
- Modify: `public/data/dungeons.json`

The abbreviations below are 2–5 characters, unique across all 49 dungeons, and derived from the dungeon name's key words.

- [ ] **Step 1: Add `abbrev` to every dungeon entry**

Open `public/data/dungeons.json`. For each dungeon in the `"dungeons"` array, insert `"abbrev": "<value>"` after `"name"`. The complete mapping:

| id  | abbrev | name |
|-----|--------|------|
| 375 | `MoTS` | Mists of Tirna Scithe |
| 376 | `NW`   | The Necrotic Wake |
| 377 | `DOS`  | De Other Side |
| 378 | `HoA`  | Halls of Atonement |
| 379 | `PF`   | Plaguefall |
| 380 | `SD`   | Sanguine Depths |
| 381 | `SoA`  | Spires of Ascension |
| 382 | `ToP`  | Theater of Pain |
| 391 | `TazS` | Tazavesh: Streets of Wonder |
| 392 | `TazG` | Tazavesh: So'leah's Gambit |
| 169 | `IRD`  | Iron Docks |
| 166 | `GRD`  | Grimrail Depot |
| 234 | `RKU`  | Return to Karazhan: Upper |
| 227 | `RKL`  | Return to Karazhan: Lower |
| 369 | `OJY`  | Operation: Mechagon - Junkyard |
| 370 | `OWS`  | Operation: Mechagon - Workshop |
| 206 | `NL`   | Neltharion's Lair |
| 251 | `UNDR` | The Underrot |
| 245 | `FH`   | Freehold |
| 403 | `ULD`  | Uldaman: Legacy of Tyr |
| 404 | `NTH`  | Neltharus |
| 405 | `BHH`  | Brackenhide Hollow |
| 406 | `HoI`  | Halls of Infusion |
| 438 | `VP`   | The Vortex Pinnacle |
| 168 | `EVB`  | The Everbloom |
| 198 | `DHT`  | Darkheart Thicket |
| 199 | `BRH`  | Black Rook Hold |
| 248 | `WCM`  | Waycrest Manor |
| 244 | `ADZ`  | Atal'Dazar |
| 463 | `DTIG` | Dawn of the Infinite: Galakrond's Fall |
| 464 | `DTIM` | Dawn of the Infinite: Murozond's Rise |
| 456 | `TotT` | Throne of the Tides |
| 399 | `RLP`  | Ruby Life Pools |
| 400 | `NOK`  | The Nokhud Offensive |
| 401 | `AV`   | The Azure Vault |
| 402 | `AlAc` | Algeth'ar Academy |
| 353 | `SotB` | Siege of Boralus |
| 501 | `StV`  | The Stonevault |
| 502 | `CoT`  | City of Threads |
| 503 | `ArK`  | Ara-Kara, City of Echoes |
| 505 | `DWN`  | The Dawnbreaker |
| 507 | `GB`   | Grim Batol |
| 247 | `MTHL` | The MOTHERLODE!! |
| 525 | `FLG`  | Operation: Floodgate |
| 499 | `PSF`  | Priory of the Sacred Flame |
| 500 | `RKY`  | The Rookery |
| 504 | `DfC`  | Darkflame Cleft |
| 506 | `CBM`  | Cinderbrew Meadery |
| 542 | `EDA`  | Eco-Dome Al'dani |

Example of a correctly updated entry:
```json
{
  "id": 375,
  "name": "Mists of Tirna Scithe",
  "abbrev": "MoTS",
  "era": "shadowlands",
  "offWorld": true,
  "zone": "ardenweald"
}
```

- [ ] **Step 2: Verify build passes (no missing-field errors)**

```bash
npm run build
```

Expected: no TypeScript errors from `DungeonMeta` (the type checker validates JSON imports through the manifest fetch, not statically, so this mainly verifies the TS side compiles).

- [ ] **Step 3: Verify abbreviations are unique**

```bash
node -e "
const d = require('./public/data/dungeons.json');
const abbrevs = d.dungeons.map(x => x.abbrev);
const dups = abbrevs.filter((a, i) => abbrevs.indexOf(a) !== i);
if (dups.length) console.error('DUPLICATE:', dups);
else console.log('All', abbrevs.length, 'abbrevs unique ✓');
"
```

Expected: `All 49 abbrevs unique ✓`

- [ ] **Step 4: Commit**

```bash
git add public/data/dungeons.json
git commit -m "✨ Add dungeon abbreviations to manifest"
```

---

## Task 3: Restructure layout

**Files:**
- Modify: `index.html`
- Modify: `src/style.css`

- [ ] **Step 1: Replace `index.html` body**

Replace the contents of `<body>` with:

```html
<body>
  <div id="layout">
    <div id="heatmap"></div>
    <div id="arc"></div>
    <div id="map"></div>
  </div>

  <script type="module" src="/src/main.ts"></script>
</body>
```

The `#left` wrapper is removed. `#map` stays in the DOM (so `getElementById('map')` in `init.ts` still resolves) but will be hidden by CSS.

- [ ] **Step 2: Replace all layout rules in `src/style.css`**

Replace the existing `#layout`, `#left`, `#map`, `#arc`, `#heatmap` rule blocks with:

```css
#layout {
  display: flex;
  flex-direction: row;
  height: 100vh;
}

#heatmap {
  flex: 1.4;
  overflow-y: auto;
  overflow-x: hidden;
  background: #18181b;
  border-right: 1px solid #27272a;
}

#arc {
  flex: 1;
  overflow: hidden;
  background: #18181b;
}

#map {
  display: none;
}
```

- [ ] **Step 3: Start dev server and confirm no JS errors in console**

```bash
npm run dev
```

Open `http://localhost:5173`. The page should load without errors. The arc panel placeholder message ("Select a dungeon…") should be visible on the right. The heatmap area shows "Loading…" or the old chart depending on whether heatmap.ts has been rewritten yet.

- [ ] **Step 4: Commit**

```bash
git add index.html src/style.css
git commit -m "💄 Restructure layout: heatmap left, arc right, map hidden"
```

---

## Task 4: Rewrite heatmap.ts as swimlane chart

**Files:**
- Rewrite: `src/charts/heatmap.ts`
- Modify: `src/style.css` (append swimlane styles)

- [ ] **Step 1: Add swimlane CSS to `src/style.css`**

Append to the end of `src/style.css`:

```css
/* --- Swimlane heatmap --- */

.heatmap-title {
  padding: 10px 12px 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #71717a;
}

.heatmap-lanes {
  padding: 0 12px;
}

.lane {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.lane--faded .tile {
  opacity: 0.15;
}

.lane-label {
  font-size: 9px;
  color: #52525b;
  width: 40px;
  text-align: right;
  flex-shrink: 0;
  white-space: nowrap;
}

.lane-tiles {
  display: flex;
  gap: 3px;
}

.tile {
  position: relative;
  width: 38px;
  height: 22px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8.5px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 0.12s;
}

.tile--highlighted {
  outline: 2px solid #fbbf24;
  outline-offset: 1px;
}

.tile--selected {
  outline: 2px solid #818cf8;
  outline-offset: 1px;
}

.tile-tooltip {
  display: none;
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 6px;
  padding: 7px 10px;
  font-size: 11px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 10;
  color: #f4f4f5;
  line-height: 1.5;
}

.tile:hover .tile-tooltip {
  display: block;
}

.heatmap-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 12px 12px;
  margin-top: 6px;
  border-top: 1px solid #27272a;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 9px;
  color: #71717a;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
}
```

- [ ] **Step 2: Rewrite `src/charts/heatmap.ts`**

Replace the entire file with:

```typescript
import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import { ERA_PALETTE, ERA_LABELS, ERAS_IN_ORDER } from '../config.js';
import { getSeasonRankMatrix } from '../db/queries.js';
import { loadSeason } from '../db/init.js';
import { computeRanks } from '../utils/ranks.js';
import { setState, subscribe } from '../state.js';
import type { DungeonManifest, RankMatrixRow, SeasonMeta } from '../types.js';

export async function initHeatmap(
  container: HTMLElement,
  manifest: DungeonManifest,
  conn: AsyncDuckDBConnection,
): Promise<{ minKey: number; maxKey: number }> {
  const seasons = manifest.seasons
    .filter((s) => s.dungeonIds.length > 0)
    .sort((a, b) => a.id - b.id);

  container.textContent = 'Loading…';
  await Promise.all(seasons.map((s) => loadSeason(s.id)));

  const rawRows: RankMatrixRow[] = [];
  for (const s of seasons) {
    const rows = await getSeasonRankMatrix(conn, s.id);
    rawRows.push(...rows);
  }

  const ranked = computeRanks(rawRows);

  // Per-season sorted list: rank 1 (best) first → leftmost tile
  const bySeason = new Map<number, typeof ranked>();
  for (const season of seasons) {
    bySeason.set(
      season.id,
      ranked.filter((r) => r.season_id === season.id).sort((a, b) => a.rank - b.rank),
    );
  }

  container.textContent = '';

  const titleEl = document.createElement('div');
  titleEl.className = 'heatmap-title';
  titleEl.textContent = 'Dungeon Key Rank by Season';
  container.appendChild(titleEl);

  const lanesEl = document.createElement('div');
  lanesEl.className = 'heatmap-lanes';
  container.appendChild(lanesEl);

  for (const season of seasons) {
    const entries = bySeason.get(season.id) ?? [];

    const lane = document.createElement('div');
    lane.className = 'lane';
    lane.dataset.seasonId = String(season.id);

    const labelEl = document.createElement('div');
    labelEl.className = 'lane-label';
    labelEl.textContent = seasonAbbrev(season);
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
      const seasonShort = season.name.replace('Mythic+ Dungeons (', '').replace(')', '');
      tooltip.innerHTML = `<strong>${dungeon.name}</strong><br>${seasonShort}<br>Median key: +${r.median_key.toFixed(1)}<br>Rank ${r.rank} of ${r.total}`;
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

  // Era legend (only eras present in the manifest, in canonical order)
  const usedEras = ERAS_IN_ORDER.filter((era) =>
    manifest.dungeons.some((d) => d.era === era),
  );
  const legendEl = document.createElement('div');
  legendEl.className = 'heatmap-legend';
  for (const era of usedEras) {
    const item = document.createElement('div');
    item.className = 'legend-item';
    const dot = document.createElement('span');
    dot.className = 'legend-dot';
    dot.style.background = ERA_PALETTE[era];
    const label = document.createElement('span');
    label.textContent = ERA_LABELS[era];
    item.appendChild(dot);
    item.appendChild(label);
    legendEl.appendChild(item);
  }
  container.appendChild(legendEl);

  // Keep .tile--selected in sync with global state (e.g. arc legend clicks)
  subscribe((state) => {
    container.querySelectorAll<HTMLElement>('.tile').forEach((tile) => {
      tile.classList.toggle(
        'tile--selected',
        state.selectedDungeon !== null &&
          Number(tile.dataset.dungeonId) === state.selectedDungeon,
      );
    });
  });

  function applyHighlight(dungeonId: number): void {
    container.querySelectorAll<HTMLElement>('.lane').forEach((lane) => {
      const hasDungeon = lane.querySelector(`[data-dungeon-id="${dungeonId}"]`) !== null;
      lane.classList.toggle('lane--faded', !hasDungeon);
    });
    container.querySelectorAll<HTMLElement>('.tile').forEach((tile) => {
      tile.classList.toggle('tile--highlighted', Number(tile.dataset.dungeonId) === dungeonId);
    });
  }

  function clearHighlight(): void {
    container.querySelectorAll('.lane').forEach((l) => l.classList.remove('lane--faded'));
    container.querySelectorAll('.tile').forEach((t) => t.classList.remove('tile--highlighted'));
  }

  const allKeys = rawRows.map((r) => r.median_key);
  return {
    minKey: Math.floor(Math.min(...allKeys)),
    maxKey: Math.ceil(Math.max(...allKeys)),
  };
}

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

- [ ] **Step 3: Run unit tests — verify no regressions**

```bash
npm run test
```

Expected: all tests pass (the `computeRanks` tests in `src/utils/ranks.test.ts` should still be green).

- [ ] **Step 4: Run build — verify TypeScript**

```bash
npm run build
```

Expected: exits 0, no type errors. If `noUnusedLocals` fires on any removed import (e.g. `RankMatrixRow`), remove that import.

- [ ] **Step 5: Commit**

```bash
git add src/charts/heatmap.ts src/style.css
git commit -m "✨ Replace matrix heatmap with season swimlane chart"
```

---

## Task 5: Visual verification in the browser

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Open `http://localhost:5173`.

- [ ] **Step 2: Check swimlane renders correctly**

Verify:
- 10 season rows visible (SL S2 through TWW S3)
- Each row has 8–10 tiles, none missing
- Tile background colours match expansion eras (orange = Dragonflight, green = TWW, etc.)
- Abbreviated names visible in each tile

- [ ] **Step 3: Check hover highlight**

Hover over a tile that appears in multiple seasons (e.g. `FH` — Freehold appears in S6 and S7). Verify:
- The matching tile(s) in other seasons get a gold outline
- All other lanes fade
- Moving the mouse off clears everything

- [ ] **Step 4: Check click → arc chart**

Click any tile. Verify:
- The tile gets a purple outline
- The arc chart on the right updates to show that dungeon's weekly progression
- The clicked tile's lane is emphasized in the arc legend

- [ ] **Step 5: Check arc legend → swimlane sync**

Click a different season label in the arc chart legend. Verify the arc line emphasis changes. (Swimlane tiles do not change on arc legend click — only arc chart changes. The selected-tile ring stays on the clicked tile from step 4.)

- [ ] **Step 6: Final commit**

```bash
git add -p   # review any remaining unstaged changes
git commit -m "✅ Season swimlane complete"
```
