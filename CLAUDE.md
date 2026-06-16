# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server with hot reload
npm run build        # Type-check (tsc) then bundle (vite build)
npm run preview      # Preview the production build locally
npm run fetch        # Run offline Blizzard API data collection script (~2-3 hours)
npm run test         # Run unit tests (Vitest)
npm run test:watch   # Run tests in watch mode
```

**Before running fetch after code changes:** `rm public/data/season-*.parquet` to clear old/corrupted files. **IMPORTANT:** The fetch script regenerates `dungeons.json` and resets all manual metadata (abbreviations, era, zone, offWorld) to defaults. Back up the current `public/data/dungeons.json` before running fetch, then restore metadata from the backup afterward using git: `git show HEAD:public/data/dungeons.json | jq '.dungeons'` to recover abbreviations and eras from the last commit.

## Environment

Requires a `.env` file with Blizzard Battle.net API credentials:

```
VITE_BLIZZARD_CLIENT_ID=...
VITE_BLIZZARD_CLIENT_SECRET=...
```

Vite exposes these as `import.meta.env.VITE_*` in the browser bundle. The fetch script reads them from `process.env`.

## Blizzard API Notes

- Season detail (`/mythic-keystone/season/{id}`) has no dungeon list — fetch `/connected-realm/{id}/mythic-leaderboard/index` per realm to get current-season dungeon IDs.
- Dungeon identifier in leaderboard responses is `map_challenge_mode_id`, not `id`.
- Real API response samples are saved in `docs/api-samples/` — use as reference when writing types.
- HTTP 500 from the leaderboard API means the resource doesn't exist ("Downstream Error") — not a server fault. Verify realm/dungeon/period combo is valid.
- Verified high-population US connected realm IDs used for sampling: 3676 (Area 52), 60 (Stormrage), 57 (Illidan), 3684 (Mal'Ganis), 11 (Tichondrius).
- Seasons 1–5 have no leaderboard data (Blizzard doesn't retain it); Northrend and Pandaria have no dungeons in the dataset (those appeared only in seasons 1–3).

## Architecture

Two distinct runtimes — an offline data pipeline and an in-browser viz — share no server.

### Offline pipeline (`scripts/fetch/`)

**Runtime:** ~2-3 hours with parallel batching (3 seasons at a time, 35ms API sleep), ~7+ hours sequential. Do not interrupt mid-run.

Run once via `npm run fetch`. Authenticates with Blizzard OAuth, batches seasons for parallel processing, fetches leaderboard data for a sample of US connected realms, and writes:
- `public/data/season-N.parquet` — one file per completed season
- `public/data/dungeons.json` — dungeon manifest. After generation, manually set `abbrev`, `era`, `zone`, `offWorld` per dungeon and `x`/`y` per zone anchor. See `docs/data-decisions.md` for all classification decisions already made.

**Dungeon manifest metadata:** The fetch script resets all manual fields to defaults (`abbrev: '???'`, `era: 'vanilla'`, `zone: 'unknown'`, `offWorld: false`). The properly-classified metadata is stored in git history; after fetch, restore it from the last commit using a Node script that merges old metadata into the regenerated manifest (see git history for restoration patterns in commits like 1815f52).

Uses `tsx` to run TypeScript directly and the native `duckdb` Node.js package to write Parquet.

**DuckDB data integrity:** When writing Parquet files, use `db.close(callback)` with callback to ensure writes are flushed before returning. Synchronous `db.close()` can leave files incomplete ("no magic bytes" error). See `scripts/fetch/write.ts:writeParquet()`.

### In-browser viz (`src/`)

Fully static — no backend. Data flow:

1. **`src/db/init.ts`** — initializes DuckDB-Wasm (requires COOP/COEP headers, configured in `vite.config.ts`) and lazily loads season Parquet files on demand via `fetch`.
2. **`src/db/queries.ts`** — typed query functions (`getVolumeRows`, `getKeyDistribution`, `getCrossSeasonVolume`) that run SQL against in-memory DuckDB tables.
3. **`src/state.ts`** — minimal pub/sub state: `selectedSeason`, `selectedDungeon`, `viewMode`, `filterEras`. All chart modules subscribe to this.
4. **`src/charts/`** — D3.js chart modules. Each exports an `init*` function. `charts/init.ts` orchestrates the full startup sequence: load manifest → init all charts → subscribe to state changes.

### Dashboard Views

Layout is three panels stacked vertically (`#dungeon-rankings`, `#key-progression`, `#affix`):

1. **Dungeon Rankings by Season** (`src/charts/dungeon-browser.ts`, `#dungeon-rankings`) — Swimlane chart showing all dungeons ranked by median key level per season. Lanes grouped by expansion. Color-coded tiles by dungeon era. Left tile = highest median key (best-performing dungeon). Clicking a tile selects that dungeon for the key progression chart.

2. **Key Progression** (`src/charts/arc.ts`, `#key-progression`) — Line chart showing median keystone level progression over time (by week/period) for the selected dungeon. One line per season (color-coded). Tooltips show week number, median key, and season. Empty state prompts user to select a dungeon. Updated when dungeon rankings panel is clicked.

3. **Affix Analysis** (`src/charts/affix.ts`, `#affix`) — Interactive panel with controls for filtering and analyzing keystone affixes. Dropdowns to select: dungeon (or all), season, and affix type (Fortified/Tyrannical/all). Shows dungeon performance metrics (count, avg key) grouped by affix combinations. Tabs for different analysis lenses (e.g., per-affix breakdown).

**Affix panel filtering:** Dynamically shows only seasons where selected dungeons were active (dungeon lineups differ per season). Season selection is synchronized with key progression chart via `selectedSeasonForArc` state. Use `getAvailableSeasonsForDungeons()` helper to validate dungeon/season combos before querying.

**View Interactions:**
- **Dungeon Rankings ↔ Key Progression:** Clicking a tile in dungeon rankings updates `selectedDungeon` in state, which triggers the key progression chart to fetch and display that dungeon's progression.
- **Dungeon Rankings hover:** Hovering over dungeon tiles highlights all lanes containing that dungeon across seasons; clicking selects it for the key progression chart.
- **Key Progression → Dungeon Rankings:** Clicking a season label in the key progression chart highlights the corresponding lane in dungeon rankings.
- **Affix ↔ Key Progression (Season):** Both views share `selectedSeasonForArc` state. Clicking a line in key progression selects that season in affix panel; clicking an affix season button updates key progression emphasis. "View All" button in key progression title resets to null.
- **Affix ← Dungeon Selection:** Responds to `selectedDungeons` state and filters available seasons dynamically. Only shows seasons where ALL selected dungeons were active.

The dashboard layout zones are defined in `index.html`. Layout and styling use plain CSS in `src/style.css` — no CSS framework. Tailwind was dropped because `Cross-Origin-Embedder-Policy: require-corp` (required for DuckDB-Wasm SharedArrayBuffer) blocks external CDN scripts that lack a `Cross-Origin-Resource-Policy` header.

### TypeScript configs

Two separate configs: `tsconfig.json` (browser, `moduleResolution: bundler`, `noEmit: true`) and `scripts/tsconfig.json` (Node.js, `moduleResolution: node16`, emit enabled). Type-check both when touching shared interfaces. `tsc --project scripts/tsconfig.json` will report "No inputs found" until `.ts` files exist in `scripts/` — expected, not a config error.

## Domain Knowledge

- **Dungeon seasons:** Dungeon lineups change each season. Example: Season 13 has dungeons [353, 375, 376, 501, 502, 503, 505, 507]; Season 14 has [247, 370, 382, 525, 499, 500, 504, 506]; Season 15 has [378, 391, 392, 525, 499, 503, 505, 542]. Always validate dungeon/season combos exist before querying.
- **War Within affixes:** Season 13+ changed affix system — both Fortified and Tyrannical are active simultaneously in all periods. Pre-Season 13 alternated them weekly. Queries must handle this split (`getPrimaryAffixTrend()` checks `seasonId >= 13`).

## TypeScript

Strict settings: `noUnusedLocals`, `noUnusedParameters`. No `any` assertions without justification. `Era` type and `DungeonManifest` shape are defined separately in `scripts/fetch/types.ts` and `src/types.ts` — keep them in sync.

**DOM queries:** Always cast `document.querySelector()` result to `HTMLElement | null` explicitly in strict mode. Use `textContent` over `innerHTML` when building DOM from manifest data (safer pattern, even though data isn't user-provided).

**Nested component rendering:** When building multi-level components (selector → content), clear parent once then append children in order. Avoid render functions clearing their containers — have them append instead.

## Planning

When writing implementation plans, describe steps at a high level — what files to create, what functions/interfaces each contains, and what each step accomplishes. Do not include full code file contents in plan documents; leave actual code for implementation time.

## Commits

Short one-line messages with a gitmoji prefix. No body, no `Co-Authored-By` trailer. Example: `✨ Add season scrubber`.
