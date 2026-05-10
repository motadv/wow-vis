# Project Goal

**Course:** Game Analytics + Data Visualization — UFF Mestrado 2026.1  
**Team:** Bruna Becker, Pedro Lanzarini, Rodrigo Mota

---

## Research Question

> **"How do a dungeon's expansion era of origin and its reintroduction history shape high-end player adoption and key-level progression across Mythic+ seasons?"**

Two sub-questions drive the analysis:

- **Question A (Era):** Does the expansion era a dungeon originates from predict its adoption among high-end players when it enters the Mythic+ pool?
- **Question B (Reintroduction):** When a dungeon is reintroduced after being absent for one or more seasons, does player familiarity produce higher key-level ceilings compared to its first appearance?

If scope forces a choice, **Question B is preferred** — it is more novel and tells a cleaner story about Blizzard's design feedback loop.

---

## Data Source & Scope

All data comes from the **Blizzard Battle.net Mythic+ Leaderboard API**, pre-fetched offline and stored as Parquet files. The API exposes only top completions per connected realm per week — not the full playerbase. All findings therefore reflect **high-end player behavior (key pushers)**, which must be stated explicitly in the paper and visualization.

Seasons covered: all completed Mythic+ seasons up to and excluding the current in-progress season.

---

## What We've Built (`demo` branch)

A fully static, screenshot-ready version of the dashboard using hardcoded mock data — no live API calls, no DuckDB, no Parquet. Built to show the project's visual direction for a course presentation.

**Implemented:**

- `src/state.ts` — lightweight pub/sub state (selected season, selected dungeon, view mode)
- `src/config.ts` — era color palette, labels, map dimensions
- `src/mock.ts` — 12 hardcoded dungeons across 5 eras, 2 mock seasons, volume + key distribution data
- `src/charts/map.ts` — D3 SVG world map with zoomable dungeon nodes (size = volume, color = era), hover tooltip, off-world cluster
- `src/charts/scrubber.ts` — season pill buttons that animate node sizes on click
- `src/charts/detail/era.ts` — horizontal bar chart comparing era averages (Question A view)
- `src/charts/detail/reintroduction.ts` — small multiples of key distribution per season appearance (Question B view)
- `src/charts/detail/index.ts` — detail panel shell with dungeon header, era badge, view toggle, close button

**Assets:** `public/map.webp` — Azeroth world map (patch 10.0), sourced from WoWpedia.

---

## What Still Needs to Be Built (`main` branch)

The full implementation connects the same chart modules to real data:

1. **Data pipeline** (`scripts/fetch/`) — transform Blizzard API responses into Parquet; write `dungeons.json` manifest
2. **DuckDB-Wasm** (`src/db/init.ts`, `src/db/queries.ts`) — load Parquet on demand in-browser; run aggregation queries
3. **Filter bar** (`src/charts/filters.ts`) — era toggles + Era/Reintroduction mode switch
4. **Full `initViz`** — replace mock imports with real DB queries; wire all modules together
5. **Manual data work** — fill `era`, `mapX`, `mapY`, `offWorld` in the generated `dungeons.json`; calibrate node positions on the map

The chart modules built in the demo branch (`map.ts`, `scrubber.ts`, `detail/`) carry forward unchanged — only the data layer is swapped.

---

## Dashboard Layout

| Zone         | Element         | Purpose                                                   |
| ------------ | --------------- | --------------------------------------------------------- |
| Top bar      | Filter bar      | Era toggles · Era/Reintroduction mode switch              |
| Center left  | World map       | Dungeon nodes (size = volume, color = era) · zoom/pan     |
| Center right | Detail panel    | Era view (Question A) or Reintroduction view (Question B) |
| Bottom bar   | Season scrubber | Step through seasons · animates node sizes                |
