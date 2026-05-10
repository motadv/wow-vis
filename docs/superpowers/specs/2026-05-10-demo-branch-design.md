# Demo Branch — Design Spec

**Date:** 2026-05-10  
**Branch:** `demo`  
**Purpose:** Static-data demo of the WoW Mythic+ dashboard for course presentation screenshots. Shows the world map with dungeon nodes, season scrubber, and detail panel without requiring a live Blizzard API connection or DuckDB-Wasm.

---

## Goal

Produce a working browser view (screenshot-ready) that demonstrates:
1. The Azeroth world map with era-colored dungeon nodes sized by activity volume
2. A season scrubber with two clickable season buttons that animate node sizes
3. A detail panel (Era view + Reintroduction view) triggered by clicking a dungeon node

No live data, no DuckDB, no Parquet. All data is hardcoded in `src/mock.ts`.

---

## Approach

**Real app, mock data layer.** The existing Vite + TypeScript + D3 stack is used unchanged. Chart modules are implemented for real — the only difference from the final app is that `initViz()` imports from `src/mock.ts` instead of calling `initDB()` / `loadSeason()`. The mock file is deleted when the real pipeline is wired up.

---

## Section 1: Branch & Mock Data

**New branch:** `demo` off `main`.

**New file: `src/mock.ts`**

Exports three hardcoded objects matching the existing types in `src/types.ts`:

- `MOCK_MANIFEST: DungeonManifest` — ~12 dungeons spanning 4–5 eras (Vanilla, WotLK, Legion, Dragonflight, TWW). Each has `mapX/mapY` pixel coordinates manually placed on the map image. Two or three dungeons marked `offWorld: true`. Two seasons defined with partially overlapping dungeon pools.
- `MOCK_VOLUME: Record<number, VolumeRow[]>` — keyed by season ID; one `VolumeRow` per dungeon with plausible entry counts and key level stats.
- `MOCK_SEASONS` — the two season entries (reused from the manifest).

`initViz()` in `src/charts/init.ts` imports from `src/mock.ts` and calls the chart modules directly. No async DB initialization.

---

## Section 2: World Map + Dungeon Nodes

**New file: `src/charts/map.ts`**

- Full-bleed SVG with `viewBox` matching map image dimensions (~2048×1400).
- `<image href="/map.png">` as background layer; node `<g>` on top with D3 zoom (`scaleExtent [0.4, 5]`).
- One `<circle>` per dungeon. Radius from sqrt scale over volume. Fill from `ERA_PALETTE` in `src/config.ts`. White stroke when selected.
- Off-world dungeons positioned at a fixed cluster coordinate with an "Off-world" text label.
- Hover tooltip: `<div>` absolutely positioned, shows dungeon name, era, max key level.
- Click sets `setState({ selectedDungeon: id })`.
- `updateVolume(rows)` updates radii with a 300ms transition.

**User action required:**
- Download a high-resolution Azeroth world map PNG from WoWpedia and place it at `public/map.png`.
- Provide pixel coordinates (`mapX`, `mapY`) for each of the ~12 hardcoded dungeons on that image.

---

## Section 3: Season Scrubber

**New file: `src/charts/scrubber.ts`**

- `initScrubber(container, seasons)` renders one pill `<button>` per season inside `#scrubber`.
- Active season highlighted (white border, brighter text).
- Clicking a button: `setState({ selectedSeason: id, selectedDungeon: null })`.
- Map subscribes to state and calls `updateVolume` with the matching mock rows.
- Demo has two seasons — sufficient to show the scrubber concept and map animation in a screenshot sequence.

---

## Section 4: Detail Panel

**New files: `src/charts/detail/index.ts`, `src/charts/detail/era.ts`, `src/charts/detail/reintroduction.ts`**

**Shell (`detail/index.ts`):**
- Subscribes to state. On `selectedDungeon` change: adds/removes `.open` on `#detail`, renders header (dungeon name, era badge, ✕ close button), delegates to the active view.
- View toggle (Era / Reintroduction) in the panel header; switching calls `setState({ viewMode })`.

**Era view (`detail/era.ts`):**
- Horizontal D3 bar chart — one bar per era, sorted descending by average entry count.
- Selected dungeon's era bar highlighted.
- Each bar labeled with abbreviated era name and count.

**Reintroduction view (`detail/reintroduction.ts`):**
- Small multiples — one mini bar chart per season the dungeon appeared in.
- All charts share the same key-level x-axis domain.
- First-appearance bars in blue, reintroduction bars in purple.
- Caption under each chart: `max key · n=count`.
- Amber warning shown if `alwaysInPool`.

**User action required:**
- For the best screenshot, click a dungeon that appears in both mock seasons so the reintroduction tab shows two side-by-side columns.

---

## Files Changed

| Path | Action |
|---|---|
| `src/mock.ts` | New — hardcoded manifest, volume, and seasons |
| `src/config.ts` | Update — add `ERA_PALETTE`, `ERA_LABELS`, `ERAS_IN_ORDER`, `MAP_WIDTH/HEIGHT`, `OFF_WORLD_X/Y` |
| `src/state.ts` | New — `getState`, `setState`, `subscribe` pub/sub |
| `src/charts/map.ts` | New — D3 SVG world map with zoom and dungeon nodes |
| `src/charts/scrubber.ts` | New — season pill buttons |
| `src/charts/detail/index.ts` | New — detail panel shell |
| `src/charts/detail/era.ts` | New — Era view bar chart |
| `src/charts/detail/reintroduction.ts` | New — Reintroduction view small multiples |
| `src/charts/init.ts` | Update — orchestrate all modules using mock data |
| `public/map.png` | Manual — user must provide the Azeroth world map PNG |

---

## User Inputs Required During Implementation

1. **World map PNG** — download from WoWpedia, place at `public/map.png`. Share the image dimensions (width × height in pixels) so `mapX/mapY` coordinates can be calibrated.
2. **Dungeon list** — confirm or adjust the ~12 hardcoded dungeons (names and eras). A suggested list will be provided in the plan.
3. **Pixel coordinates** — for each dungeon on the map image, approximate x/y pixel position. Can be done by opening the PNG in any image viewer and reading coordinates, or described verbally ("roughly center of Eastern Kingdoms, upper third").

---

## Out of Scope

- DuckDB-Wasm initialization
- Parquet loading
- Live Blizzard API calls
- Filter bar (era toggles, key level threshold)
- Drag scrubber (click-only for demo)
- Heatmap stretch goal
