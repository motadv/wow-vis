# Keystone Progression Redesign — Design Spec

**Date:** 2026-06-09
**Context:** Class project on game analytics and data visualization. Final deliverable is a dashboard with an accompanying short article.

---

## Problem

The original era-view hypothesis — that expansion of origin influences dungeon adoption — cannot be tested with this dataset. Blizzard's M+ leaderboard stores only the top ~500 runs per dungeon per realm per week, so every active dungeon in a season hits the same entry-count ceiling (~60,000 rows). Volume is not a meaningful signal.

## Reframed Research Questions

1. **Within a season:** how does a dungeon's competitive ceiling (median keystone level) evolve week-by-week? Do some dungeons peak early or plateau higher than others?
2. **Across seasons:** for dungeons that appear in multiple seasons, does their relative difficulty rank (how hard players push them compared to peers) stay stable or shift?

These questions are answerable with the `keystone_level` and `period` columns already in the parquet files.

---

## Architecture

### What stays

- World map (`src/charts/map.ts`, `#map` zone) — unchanged, geographic entry point
- DuckDB-Wasm init (`src/db/init.ts`) — unchanged
- State model (`src/state.ts`) — extended, not replaced
- Manifest loading and season metadata — unchanged

### What changes

- `#detail` and `#scrubber` layout zones replaced by `#heatmap` and `#arc`
- `src/charts/` — two existing chart modules removed, two new ones added
- `src/db/queries.ts` — two new query functions, three old ones removed
- `src/types.ts` — two new row types added, old ones removed
- `src/state.ts` — `viewMode` and `filterEras` removed; `selectedSeasonForArc` added

---

## State Changes

```
selectedSeason: number          // unchanged — season highlighted on map
selectedDungeon: number | null  // unchanged — dungeon selected globally
selectedSeasonForArc: number    // which season's arc line is emphasized; defaults to selectedSeason when dungeon selected
```

`viewMode` and `filterEras` are removed. Era is encoded visually (row label color in heatmap) rather than as an interactive filter.

---

## Data Layer

### Removed queries
- `getVolumeRows` — replaced by heatmap
- `getKeyDistribution` — replaced by heatmap
- `getCrossSeasonVolume` — replaced by arc

### New query: `getSeasonRankMatrix`

```
getSeasonRankMatrix(conn, seasonIds: number[]): Promise<RankMatrixRow[]>
```

Returns one row per (dungeon, season) pair: `dungeon_id`, `season_id`, `median_key`. Called once on startup for all seasons with data (IDs 6–15). The normalization to within-season rank is computed in the browser (sort per season, assign rank 1–N) since the result set is tiny (~80 rows).

### New query: `getWeeklyArc`

```
getWeeklyArc(conn, dungeonId: number, seasonId: number): Promise<WeeklyArcRow[]>
```

Returns one row per period: `period_index` (1-based, derived from ordering raw period IDs ascending), `median_key`. Called on demand when a dungeon+season is selected.

### New types

```ts
interface RankMatrixRow {
  dungeon_id: number;
  season_id: number;
  median_key: number;
}

interface WeeklyArcRow {
  period_index: number;
  median_key: number;
}
```

---

## Heatmap Panel (`#heatmap`)

**What it shows:** A matrix of all seasons with data (columns, 6–15) × all dungeons that appeared in at least one of those seasons (rows). Cell color encodes the dungeon's **within-season rank** — rank 1 = highest median key in that season = darkest cell; rank N = lowest = lightest cell — on a sequential single-hue scale. Cells for seasons where the dungeon was not active are neutral grey.

**Why normalized rank, not raw key level:** Key level scales differ between expansion eras (SL seasons peaked at key 30+; DF/TWW seasons peak at key 15–20). Raw values would make the color gradient reflect the era calendar rather than relative dungeon performance within a season.

**Row ordering:** Dungeons sorted descending by mean normalized rank across all seasons they appeared in. Consistently high-pushed dungeons float to the top.

**Era encoding:** Dungeon name labels on the left are colored using the existing era palette. This preserves the expansion-of-origin signal without making it the dominant encoding.

**Interaction:**
- Click a cell → sets `selectedDungeon` and `selectedSeasonForArc`; map highlights the dungeon's zone; arc panel updates
- Hover a cell → tooltip showing dungeon name, season name, raw median key, and rank (e.g., "3rd of 8")
- When `selectedDungeon` changes (e.g., via map click) → entire dungeon row highlighted in heatmap

**Loading:** The heatmap queries all seasons in parallel on startup. Cells for seasons whose parquet file hasn't loaded yet show a neutral placeholder. No blocking spinner.

---

## Season Arc Panel (`#arc`)

**What it shows:** A multi-line chart for the selected dungeon. X-axis = week number within season (period index 1–N, not raw Blizzard period IDs). Y-axis = median keystone level that week for this dungeon. One line per season the dungeon appeared in.

**Season lines:** Colored by a sequential palette keyed to season ID (not era — era is already in the heatmap). The line for `selectedSeasonForArc` is drawn at full opacity and thicker; all other seasons are drawn lighter as context.

**Axes:**
- X: labeled "Week 1", "Week 2", … (period index)
- Y: raw median key level (normalization not applied here — within a single dungeon's arc, raw keys are directly comparable across seasons)

**Legend:** Maps line color → season name.

**Interaction:** Clicking a season line sets `selectedSeasonForArc`, emphasizing that line and syncing the heatmap cell highlight.

**Empty state:** When no dungeon is selected, the panel shows: *"Select a dungeon on the map or heatmap to see its weekly progression."*

---

## Layout

`index.html` is restructured as follows. `#filters` and `#scrubber` are removed entirely. `#detail` is replaced by `#heatmap`. A new `#arc` zone is added below `#middle`:

```html
<div id="layout">
  <div id="middle">
    <div id="map"></div>
    <div id="heatmap"></div>
  </div>
  <div id="arc"></div>
</div>
```

CSS: `#middle` keeps its left/right split (map left, heatmap right). `#arc` sits below `#middle` as a full-width panel, approximately 35% of total viewport height.

---

## Error Handling

No new error boundaries. DuckDB-Wasm init errors are handled by the existing `src/db/init.ts` flow. Individual query errors log to console and leave the affected panel empty rather than crashing the dashboard.

---

## Files to Create

- `src/charts/heatmap.ts` — `initHeatmap(conn, manifest)` function
- `src/charts/arc.ts` — `initArc(conn, manifest)` function

## Files to Modify

- `src/db/queries.ts` — add `getSeasonRankMatrix`, `getWeeklyArc`; remove old queries
- `src/types.ts` — add `RankMatrixRow`, `WeeklyArcRow`; remove `VolumeRow`, `KeyDistRow`, `CrossSeasonRow`
- `src/state.ts` — add `selectedSeasonForArc`; remove `viewMode`, `filterEras`
- `src/charts/init.ts` — wire up new charts, remove old ones
- `index.html` — restructure layout (see Layout section above)
- `src/style.css` — update layout for new zones
- `src/config.ts` — remove ERA_LABELS / era toggle config if only used by filters

## Files to Delete

- `src/charts/detail/era.ts`
- `src/charts/detail/reintroduction.ts`
- `src/charts/detail/index.ts`
- `src/charts/scrubber.ts`
- `src/charts/filters.ts`
