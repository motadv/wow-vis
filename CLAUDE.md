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

**Before running fetch after code changes:** `rm public/data/season-*.parquet` to clear old/corrupted files.

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
- `public/data/dungeons.json` — dungeon manifest. After generation, manually set `era`, `zone`, `offWorld` per dungeon and `x`/`y` per zone anchor. See `docs/data-decisions.md` for all classification decisions already made.

Uses `tsx` to run TypeScript directly and the native `duckdb` Node.js package to write Parquet.

**DuckDB data integrity:** When writing Parquet files, use `db.close(callback)` with callback to ensure writes are flushed before returning. Synchronous `db.close()` can leave files incomplete ("no magic bytes" error). See `scripts/fetch/write.ts:writeParquet()`.

### In-browser viz (`src/`)

Fully static — no backend. Data flow:

1. **`src/db/init.ts`** — initializes DuckDB-Wasm (requires COOP/COEP headers, configured in `vite.config.ts`) and lazily loads season Parquet files on demand via `fetch`.
2. **`src/db/queries.ts`** — typed query functions (`getVolumeRows`, `getKeyDistribution`, `getCrossSeasonVolume`) that run SQL against in-memory DuckDB tables.
3. **`src/state.ts`** — minimal pub/sub state: `selectedSeason`, `selectedDungeon`, `viewMode`, `filterEras`. All chart modules subscribe to this.
4. **`src/charts/`** — D3.js chart modules. Each exports an `init*` function. `charts/init.ts` orchestrates the full startup sequence: load manifest → init all charts → subscribe to state changes.

The dashboard has four layout zones (`#filters`, `#map`, `#detail`, `#scrubber`) defined in `index.html`. Layout and styling use plain CSS in `src/style.css` — no CSS framework. Tailwind was dropped because `Cross-Origin-Embedder-Policy: require-corp` (required for DuckDB-Wasm SharedArrayBuffer) blocks external CDN scripts that lack a `Cross-Origin-Resource-Policy` header.

### TypeScript configs

Two separate configs: `tsconfig.json` (browser, `moduleResolution: bundler`, `noEmit: true`) and `scripts/tsconfig.json` (Node.js, `moduleResolution: node16`, emit enabled). Type-check both when touching shared interfaces. `tsc --project scripts/tsconfig.json` will report "No inputs found" until `.ts` files exist in `scripts/` — expected, not a config error.

## TypeScript

Strict settings: `noUnusedLocals`, `noUnusedParameters`. No `any` assertions without justification. `Era` type and `DungeonManifest` shape are defined separately in `scripts/fetch/types.ts` and `src/types.ts` — keep them in sync.

## Planning

When writing implementation plans, describe steps at a high level — what files to create, what functions/interfaces each contains, and what each step accomplishes. Do not include full code file contents in plan documents; leave actual code for implementation time.

## Commits

Short one-line messages with a gitmoji prefix. No body, no `Co-Authored-By` trailer. Example: `✨ Add season scrubber`.
