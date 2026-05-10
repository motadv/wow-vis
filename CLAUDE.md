# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server with hot reload
npm run build        # Type-check (tsc) then bundle (vite build)
npm run preview      # Preview the production build locally
npm run fetch        # Run offline Blizzard API data collection script
npm run test         # Run unit tests (Vitest)
npm run test:watch   # Run tests in watch mode
```

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
- Connected realm 11 = Tichondrius/Illidan cluster (high-population US; used for leaderboard sampling).

## Architecture

Two distinct runtimes — an offline data pipeline and an in-browser viz — share no server.

### Offline pipeline (`scripts/fetch/`)

Run once via `npm run fetch`. Authenticates with Blizzard OAuth, iterates all completed Mythic+ seasons, fetches leaderboard data for a sample of US connected realms, and writes:
- `public/data/season-N.parquet` — one file per completed season
- `public/data/dungeons.json` — dungeon manifest (requires manual editing of `era`, `mapX`, `mapY`, `offWorld` fields after generation)

Uses `tsx` to run TypeScript directly and the native `duckdb` Node.js package to write Parquet.

### In-browser viz (`src/`)

Fully static — no backend. Data flow:

1. **`src/db/init.ts`** — initializes DuckDB-Wasm (requires COOP/COEP headers, configured in `vite.config.ts`) and lazily loads season Parquet files on demand via `fetch`.
2. **`src/db/queries.ts`** — typed query functions (`getVolumeRows`, `getKeyDistribution`, `getCrossSeasonVolume`) that run SQL against in-memory DuckDB tables.
3. **`src/state.ts`** — minimal pub/sub state: `selectedSeason`, `selectedDungeon`, `viewMode`, `filterEras`. All chart modules subscribe to this.
4. **`src/charts/`** — D3.js chart modules. Each exports an `init*` function. `charts/init.ts` orchestrates the full startup sequence: load manifest → init all charts → subscribe to state changes.

The dashboard has four layout zones (`#filters`, `#map`, `#detail`, `#scrubber`) defined in `index.html`, styled with plain CSS (`src/style.css`). `#detail` is hidden by default; show it by adding the `.open` class.

### TypeScript configs

Two separate configs: `tsconfig.json` (browser) and `scripts/tsconfig.json` (Node.js). Type-check both when touching shared interfaces:

```bash
npx tsc --noEmit                                    # browser
npx tsc --project scripts/tsconfig.json --noEmit   # pipeline
```

## TypeScript

Strict settings: `noUnusedLocals`, `noUnusedParameters`. No `any` assertions without justification. `Era` type and `DungeonManifest` shape are defined separately in `scripts/fetch/types.ts` and `src/types.ts` — keep them in sync.

## D3 Chart Gotchas

- **SVG height**: always compute as `margin.top + innerH + margin.bottom` — forgetting `margin.top` clips bottom axis labels.
- **SVG width vs CSS padding**: computing `panelW = clientWidth - padding*2` makes the SVG flush against the content edge; no visible gap appears. Use CSS `margin` on the wrapper div for reliable visual spacing instead.
- **Gridlines through semi-transparent bars**: bars with `opacity < 1` let gridlines show through. Append a full-width background rect (panel bg color) per bar before the colored bar to mask the gridline in that row.

## Commits

Short one-line messages with a gitmoji prefix. No body, no `Co-Authored-By` trailer. Example: `✨ Add season scrubber`.
