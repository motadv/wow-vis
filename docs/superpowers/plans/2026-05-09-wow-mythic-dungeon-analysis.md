# WoW Mythic+ Dungeon Analysis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive dashboard that visualizes how dungeon era of origin and reintroduction history shape high-end Mythic+ player adoption across seasons, rendered on top of the Azeroth world map.

**Architecture:** An offline Node.js fetch script pulls Blizzard Mythic+ leaderboard data for a sample of connected realms, writes per-season Parquet files and a `dungeons.json` manifest to `public/data/`. At runtime, DuckDB-Wasm loads these files on demand and executes aggregation queries; D3.js renders a zoomable world map with dungeon nodes, a season scrubber, a filter bar, and a detail panel with Era and Reintroduction views.

**Tech Stack:** Vite + TypeScript, D3.js v7, @duckdb/duckdb-wasm, plain CSS (no framework — Tailwind CDN is incompatible with `Cross-Origin-Embedder-Policy: require-corp`), Node.js 18+ with native `duckdb` and `tsx` for the offline script, Vitest for unit tests.

---

## File Map

### New files

| Path                                  | Responsibility                                                                                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `vite.config.ts`                      | COOP/COEP headers + exclude DuckDB-Wasm from pre-bundling                                                                                      |
| `scripts/tsconfig.json`               | TypeScript config for Node.js scripts (`moduleResolution: node16`)                                                                             |
| `scripts/fetch/types.ts`              | Pipeline types: `Era`, `DungeonMeta`, `SeasonMeta`, `DungeonManifest`, `LeaderboardEntry`, raw Blizzard API shapes                             |
| `scripts/fetch/auth.ts`               | `fetchToken(clientId, clientSecret): Promise<string>` — OAuth client credentials                                                               |
| `scripts/fetch/auth.test.ts`          | Unit tests for `fetchToken` using mocked `fetch`                                                                                               |
| `scripts/fetch/blizzard.ts`           | `fetchSeasonIds`, `fetchSeason`, `fetchPeriodIds`, `fetchLeaderboard` — typed API wrappers                                                     |
| `scripts/fetch/transform.ts`          | `transformLeaderboard(raw, seasonId, realmId): LeaderboardEntry[]`                                                                             |
| `scripts/fetch/transform.test.ts`     | Unit tests for `transformLeaderboard`                                                                                                          |
| `scripts/fetch/write.ts`              | `writeParquet(seasonId, entries)` and `writeManifest(manifest)` using native `duckdb`                                                          |
| `scripts/fetch/index.ts`              | CLI orchestrator: auth → fetch all seasons → write Parquet + manifest                                                                          |
| `src/types.ts`                        | Viz types: `Era`, `DungeonMeta`, `SeasonMeta`, `DungeonManifest`, `VolumeRow`, `KeyDistRow`, `CrossSeasonRow`, `AppState`                      |
| `src/state.ts`                        | `getState()`, `setState(patch)`, `subscribe(listener)` — simple pub/sub over `AppState`                                                        |
| `src/db/queries.ts`                   | `getVolumeRows(conn, seasonId)`, `getKeyDistribution(conn, seasonId, dungeonId)`, `getCrossSeasonVolume(conn, dungeonId, seasonIds)`           |
| `src/charts/map.ts`                   | `initMap(container, manifest)`, `updateVolume(rows)` — zoomable SVG map with D3-bound dungeon nodes                                            |
| `src/charts/scrubber.ts`              | `initScrubber(container, seasons)` — season button bar, updates state on click                                                                 |
| `src/charts/filters.ts`               | `initFilters(container)` — era toggle buttons + Era/Reintroduction view mode toggle                                                            |
| `src/charts/detail/index.ts`          | `initDetail(container, manifest, conn)`, `setAllVolume(rows)` — detail panel shell, subscribes to state, delegates to era/reintroduction views |
| `src/charts/detail/era.ts`            | `renderEraView(container, dungeon, thisVolume, allVolume, manifest)` — bar chart comparing era averages                                        |
| `src/charts/detail/reintroduction.ts` | `renderReintroductionView(container, dungeon, snapshots)` + `SeasonSnapshot` type — small multiples of key distribution per season appearance  |

### Modified files

| Path                 | Changes                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `package.json`       | Add `tsx`, `duckdb`, `vitest`, `@types/node` to devDeps; add `fetch`, `test`, `test:watch` scripts                     |
| `index.html`         | Four-zone dark layout: `#filters` (top), `#map` + `#detail` (middle), `#scrubber` (bottom); Tailwind CDN               |
| `src/config.ts`      | `MAP_WIDTH/HEIGHT`, `OFF_WORLD_X/Y`, `ERA_PALETTE`, `ERA_LABELS`, `ERAS_IN_ORDER`                                      |
| `src/db/init.ts`     | `initDB()` — DuckDB-Wasm bundle setup with COOP/COEP worker; `loadSeason(id)` — lazy Parquet loader; `getConnection()` |
| `src/charts/init.ts` | `initViz()` — fetch manifest, init all chart modules, subscribe to state changes, run initial data load                |
| `src/main.ts`        | Call `initViz()`, remove placeholder D3 code                                                                           |

### Manual assets (required before running the viz)

| Path                        | How                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| `public/map.png`            | Download high-res Azeroth world map PNG from WoW Wiki                                              |
| `public/data/dungeons.json` | Generated by `npm run fetch`; must manually set `era`, `mapX`, `mapY`, `offWorld` for each dungeon |

---

## Task 1: Project Setup

**Files:** `package.json`, `vite.config.ts`, `scripts/tsconfig.json`

- [x] Add `tsx`, `duckdb`, `vitest`, `@types/node` to `devDependencies` in `package.json`; add `fetch`, `test`, `test:watch` npm scripts
- [x] Run `npm install` and verify new packages are present
- [x] Create `vite.config.ts` — exclude `@duckdb/duckdb-wasm` from `optimizeDeps`; set `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` server headers (required for SharedArrayBuffer)
- [x] Create `scripts/tsconfig.json` extending root tsconfig, overriding `moduleResolution: node16`, `module: node16`, `noEmit: false`, `types: ["node"]`
- [x] Type-check both configs with `tsc --noEmit`
- [x] Commit

---

## Task 2: Shared Types

**Files:** `scripts/fetch/types.ts`, `src/types.ts`

- [ ] Create `scripts/fetch/types.ts` with pipeline types: `Era` union, `DungeonMeta`, `SeasonMeta`, `DungeonManifest`, `LeaderboardEntry` (snake_case fields to match Parquet column names), and raw Blizzard API shapes (`BlizzardSeason`, `BlizzardLeaderboard`, `BlizzardLeaderboardGroup`)
- [ ] Create `src/types.ts` with viz types: same `Era`/`DungeonMeta`/`SeasonMeta`/`DungeonManifest`, plus `VolumeRow`, `KeyDistRow`, `CrossSeasonRow`, `AppState` (`selectedSeason`, `selectedDungeon`, `viewMode`, `filterEras`)
- [ ] Type-check both configs; commit

---

## Task 3: Dashboard HTML Layout

**Files:** `index.html`, `src/style.css`, `src/main.ts`

- [x] Replace `index.html` body with four-zone dark layout using plain CSS: `#filters` bar at top, `#map` + `#detail` (hidden by default, revealed via `.open` class) in middle, `#scrubber` at bottom
- [ ] Strip `src/style.css` to a minimal box-sizing reset
- [ ] Replace `src/main.ts` with a single `initViz()` call (stub import — will be implemented in Task 13)
- [ ] Run `npm run dev` and confirm dark empty layout renders without errors; commit

---

## Task 4: Blizzard Auth

**Files:** `scripts/fetch/auth.ts`, `scripts/fetch/auth.test.ts`

- [ ] Write failing tests first: mock `fetch` globally with `vi.stubGlobal`; test that `fetchToken` returns the `access_token` on success and throws with the status code on a non-ok response
- [ ] Run tests — confirm they fail
- [ ] Implement `fetchToken(clientId, clientSecret)`: base64-encode credentials, POST to `https://oauth.battle.net/token` with `grant_type=client_credentials`, return `access_token`
- [ ] Run tests — confirm they pass; commit

---

## Task 5: Blizzard API Client

**Files:** `scripts/fetch/blizzard.ts`

- [ ] Implement a private `get<T>(path, token)` helper that prepends `https://us.api.blizzard.com`, appends `?namespace=dynamic-us&locale=en_US`, sets `Authorization: Bearer` header, and throws on non-ok responses
- [ ] Implement `fetchSeasonIds`, `fetchSeason`, `fetchPeriodIds`, `fetchLeaderboard` as thin wrappers over `get<T>`
- [ ] Type-check; commit (no unit tests — these wrappers are verified by the integration run in Task 7)

---

## Task 6: Data Transformation

**Files:** `scripts/fetch/transform.ts`, `scripts/fetch/transform.test.ts`

- [ ] Write failing tests: given a `BlizzardLeaderboard` with two `leading_groups`, assert `transformLeaderboard` returns an array of the right length with correct snake_case field values; also assert empty `leading_groups` returns `[]`
- [ ] Run tests — confirm they fail
- [ ] Implement `transformLeaderboard(raw, seasonId, realmId)`: map each `leading_group` to a `LeaderboardEntry` with `dungeon_id`, `season_id`, `period`, `realm_id`, `keystone_level`, `duration_ms`
- [ ] Run tests — confirm they pass; commit

---

## Task 7: Parquet Writer + Fetch Orchestrator

**Files:** `scripts/fetch/write.ts`, `scripts/fetch/index.ts`

- [ ] Implement `write.ts`:
  - `ensureOutDir()` creates `public/data/` if missing
  - `writeParquet(seasonId, entries)`: serialize entries as NDJSON to a temp file, use native `duckdb` to `COPY ... TO season-N.parquet (FORMAT PARQUET)`, then delete the temp file
  - `writeManifest(manifest)`: write `public/data/dungeons.json`
- [ ] Implement `index.ts` orchestrator:
  - Read `VITE_BLIZZARD_CLIENT_ID/SECRET` from `process.env`; throw if missing
  - Fetch season index + period index
  - For each completed season (skip if `end_timestamp` is null or in the future): build `SeasonMeta`, register dungeons in a `Map` with placeholder `era/mapX/mapY/offWorld`, iterate over dungeon × realm × period combinations to fetch leaderboards (sample 4 high-population US realm IDs; sleep 55ms between requests to respect rate limits), collect entries, write Parquet
  - Write `dungeons.json` manifest at the end
- [ ] Type-check; run `npm run fetch` against the real API; confirm Parquet files and `dungeons.json` appear in `public/data/`
- [ ] Manually fill `era`, `mapX`, `mapY`, `offWorld` in `dungeons.json` for each dungeon; commit

---

## Task 8: DuckDB-Wasm Init

**Files:** `src/db/init.ts`

- [ ] Implement `initDB()`: import WASM bundles via Vite `?url` imports, call `duckdb.selectBundle`, create a Worker, open the DB with `castBigIntToDouble: true`
- [ ] Implement `loadSeason(seasonId)`: idempotent — `CREATE TABLE IF NOT EXISTS leaderboard_N AS SELECT * FROM read_parquet('/data/season-N.parquet')`, track loaded seasons in a `Set`
- [ ] Implement `getConnection()`: return the module-level connection, throw if not initialized
- [ ] Smoke test in browser by temporarily calling `initDB()` + `loadSeason(1)` in `main.ts`; verify no COOP/COEP errors; commit

---

## Task 9: Query Functions

**Files:** `src/db/queries.ts`

- [ ] Implement `getVolumeRows(conn, seasonId)`: aggregate `leaderboard_N` by `dungeon_id`, returning `COUNT`, `MIN`, `MEDIAN`, `MAX` of `keystone_level`; map result rows to `VolumeRow[]`
- [ ] Implement `getKeyDistribution(conn, seasonId, dungeonId)`: group by `keystone_level` for one dungeon, return `KeyDistRow[]` sorted ascending
- [ ] Implement `getCrossSeasonVolume(conn, dungeonId, seasonIds)`: `UNION ALL` across multiple `leaderboard_N` tables, aggregate per season, return `CrossSeasonRow[]`
- [ ] Type-check; commit (verified by browser smoke test in Task 16)

---

## Task 10: State and Config

**Files:** `src/state.ts`, `src/config.ts`

- [ ] Implement `state.ts`: module-level `AppState` object (`selectedSeason: -1`, `selectedDungeon: null`, `viewMode: 'era'`, `filterEras: []`); `getState()`, `setState(patch)` (merges and notifies), `subscribe(listener)` (returns unsubscribe fn)
- [ ] Populate `config.ts`: `MAP_WIDTH = 2048`, `MAP_HEIGHT = 1400`, `OFF_WORLD_X/Y` for off-world cluster, `ERA_PALETTE` (one hex color per era), `ERA_LABELS` (full expansion name per era), `ERAS_IN_ORDER` array
- [ ] Type-check; commit

---

## Task 11: World Map + Dungeon Nodes

**Files:** `src/charts/map.ts`

- [ ] Implement `initMap(container, manifest)`:
  - Append a full-size SVG with `viewBox` matching `MAP_WIDTH × MAP_HEIGHT`
  - Attach D3 zoom behavior (`scaleExtent [0.4, 5]`) to an inner `<g>`
  - Add `<image href="/map.png">` as map background
  - Add "Off-world" text label at `OFF_WORLD_X/Y`
  - Subscribe to state changes and call `renderNodes()`
- [ ] Implement `updateVolume(rows)`: rebuild `volumeMap`, update `rScale` domain, call `renderNodes()`
- [ ] Implement `renderNodes()`: D3 data join on `manifest.dungeons`; nodes use sqrt scale radius (volume), era palette fill, white stroke when selected, opacity 0.15 for inactive/filtered, 300ms transition; click calls `setState({ selectedDungeon: id })`; off-world dungeons positioned at cluster coords
- [ ] Type-check; commit

---

## Task 12: Season Scrubber

**Files:** `src/charts/scrubber.ts`

- [ ] Implement `initScrubber(container, seasons)`: render one button per season sorted by ID; clicking a button calls `setState({ selectedSeason: id, selectedDungeon: null })`; subscribe to state to toggle active highlight
- [ ] Type-check; commit

---

## Task 13: Filter Bar

**Files:** `src/charts/filters.ts`

- [ ] Implement `initFilters(container)`:
  - Era toggle buttons using `ERAS_IN_ORDER`; clicking toggles that era in/out of `filterEras` (empty = all shown)
  - Era/Reintroduction view mode toggle buttons right-aligned; clicking sets `viewMode`
  - Subscribe to state to update button opacity (dimmed when filtered out) and active highlight on mode buttons
- [ ] Type-check; commit

---

## Task 14: Detail Panel — Era View (Question A)

**Files:** `src/charts/detail/era.ts`

- [ ] Implement `renderEraView(container, dungeon, thisVolume, allVolume, manifest)`:
  - Clear container
  - Show dungeon name, entry count, and max key as text
  - Group all season volume by era, compute per-era average entry count
  - Render a horizontal bar chart (one bar per era, sorted descending); highlight this dungeon's era with a white overlay proportional to its own volume vs. the era bar
  - Label bars with abbreviated era name and stats
- [ ] Type-check; commit

---

## Task 15: Detail Panel — Reintroduction View (Question B)

**Files:** `src/charts/detail/reintroduction.ts`

- [ ] Export `SeasonSnapshot` interface: `seasonId`, `isFirstAppearance`, `alwaysInPool`, `distribution: KeyDistRow[]`, `maxKey`, `entryCount`
- [ ] Implement `renderReintroductionView(container, dungeon, snapshots)`:
  - Clear container
  - Show amber warning if `alwaysInPool`
  - Render small multiples — one mini bar chart per season snapshot, all sharing the same key level x-axis domain; first-appearance bars in blue, reintroduction bars in purple
  - Show `max key · n=count` caption under each chart
- [ ] Type-check; commit

---

## Task 16: Detail Panel Shell + Full Integration

**Files:** `src/charts/detail/index.ts`, `src/charts/init.ts`

- [ ] Implement `detail/index.ts`:
  - `initDetail(container, manifest, conn)`: subscribe to state; show/hide panel based on `selectedDungeon`; on show, call internal `render()`
  - `setAllVolume(rows)`: update module-level volume cache
  - `buildHeader(dungeon)`: construct header using safe DOM methods (`textContent`, not `innerHTML`) — dungeon name, era badge, close button that calls `setState({ selectedDungeon: null })`
  - `render(dungeonId, seasonId, viewMode)`: clear container, append header, delegate to `renderEraView` or `renderReintroductionView` based on mode; for reintroduction view, load all seasons the dungeon appeared in and build `SeasonSnapshot[]`
- [ ] Implement `src/charts/init.ts` as `initViz()`:
  - `initDB()` → fetch `dungeons.json` → `loadSeason(firstSeason)` → `setState({ selectedSeason: firstSeason.id })`
  - Call `initMap`, `initScrubber`, `initFilters`, `initDetail`
  - Subscribe to state: on season change, `loadSeason` + `getVolumeRows` + `setAllVolume` + `updateVolume`
  - Run initial data load
- [ ] Type-check with `tsc --noEmit`
- [ ] Run `npm run test` — auth and transform tests pass
- [ ] Run `npm run dev` and verify in browser:
  - [ ] Layout, era buttons, season scrubber render
  - [ ] Dungeon nodes appear on map sized by volume
  - [ ] Clicking a node opens detail panel; ✕ closes it
  - [ ] Era view shows bar chart; Reintroduction view shows small multiples
  - [ ] Era filter dims non-matching nodes; season scrubber updates node sizes
  - [ ] Off-world label visible; always-in-pool warning appears where applicable
- [ ] Run `npm run build` — no errors
- [ ] Commit
