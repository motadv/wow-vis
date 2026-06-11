# Season Swimlanes — Design Spec

**Date:** 2026-06-11
**Replaces:** sparse dungeon × season matrix heatmap

---

## Problem

The current heatmap is a 49-dungeon × 10-season matrix where ~83% of cells are empty (26 of 49 dungeons appear in only one season). The result is a mostly dark grid with no readable pattern.

---

## Solution

Replace the matrix with **season swimlanes**: one horizontal row per season, dungeons placed left→right in rank order (best median key to worst) within that season. Every cell is filled; sparsity disappears because each lane only contains the dungeons that actually ran that season.

---

## Visual Design

### Swimlane layout

- One `.lane` row per season (10 rows: S6–S15, only seasons with dungeon data).
- Each lane contains a fixed-width tile for each dungeon active that season (8–10 tiles per lane).
- Season label (e.g. `S6`) left of each lane; full season name in tile tooltip.
- Tiles sorted left→right by median keystone level descending (highest = leftmost = best).
- Tile dimensions: fixed width (≈ 38 px), fixed height (≈ 22 px), 3 px gap between tiles.

### Tile content

- Short abbreviated dungeon name inside each tile (e.g. `Freehold` → `FH`, `Nokhud Offensive` → `NOK`).
- Abbreviations stored as a new `abbrev` field in `dungeons.json` and `DungeonMeta` type — manually set, same pattern as `era` and `offWorld`.
- Tile background color = expansion era, using the existing `ERA_PALETTE` from `src/config.ts`.

### Tooltip (native `<title>` or D3 tooltip)

Shown on hover, contains:
- Full dungeon name
- Expansion era
- Median keystone level for that season
- Rank within that season (e.g. "Rank 3 of 8")

### Hover: cross-lane highlight

On `mouseenter` over a tile:
- All lanes that do not contain the hovered dungeon gain an `.faded` class (opacity: 0.18 on their tiles).
- All tiles for the same dungeon across all lanes gain a `.highlighted` class (gold outline, full opacity).

On `mouseleave`: remove all `.faded` and `.highlighted` classes.

The highlight persists visually while a dungeon is `selectedDungeon` in state (selected-tile ring in purple, distinct from the gold hover ring).

### Click: state update

Clicking a tile calls `setState({ selectedDungeon: dungeon.id, selectedSeasonForArc: season.id })`, which drives the arc chart exactly as before. The swimlane also subscribes to state changes so the cross-lane highlight updates when selection changes from outside (e.g. arc chart legend click).

---

## Data

### Queries

No new queries needed. Reuse `getSeasonRankMatrix` (returns `dungeon_id, season_id, median_key`) and `computeRanks` to derive per-season rank order. The `initHeatmap` return value `{ minKey, maxKey }` is preserved — still used by `setKeyDomain` in the arc chart.

### Abbreviations

Add `abbrev: string` to `DungeonMeta` in:
- `src/types.ts`
- `scripts/fetch/types.ts`
- `public/data/dungeons.json` (manual annotation for all 49 dungeons)

Abbreviation rules (applied manually, not algorithmic): 2–4 uppercase characters derived from significant words in the dungeon name. Must be unique across all dungeons.

---

## Architecture

### Files changed

| File | Change |
|---|---|
| `src/types.ts` | Add `abbrev: string` to `DungeonMeta` |
| `scripts/fetch/types.ts` | Same — keep in sync |
| `public/data/dungeons.json` | Add `abbrev` to all 49 dungeon entries |
| `src/charts/heatmap.ts` | Rewrite `initHeatmap` — HTML div swimlane layout replacing SVG matrix |
| `src/style.css` | Add swimlane styles; hide `#map`; update layout for new column order |
| `index.html` | Reorder: `#heatmap` (left, primary) before `#left`/`#arc` (right) |

### `initHeatmap` rewrite (heatmap.ts)

Replaces the SVG matrix with D3-bound HTML div structure:

```
#heatmap
  .heatmap-title          (panel heading)
  .lane × N_seasons
    .lane-label           (season label, e.g. "S6")
    .tile × N_dungeons    (one per active dungeon, sorted by median_key desc)
  .era-legend             (color legend for expansion eras)
```

D3 is used for data binding on `.lane` and `.tile` selections; CSS handles all visual state (`.faded`, `.highlighted`, `.selected-tile`).

Event handlers attached via D3:
- `.on('mouseenter', ...)` / `.on('mouseleave', ...)` — cross-lane highlight
- `.on('click', ...)` — `setState`

State subscription: `subscribe(state => ...)` updates `.selected-tile` class when `state.selectedDungeon` changes.

Return value: `{ minKey, maxKey }` computed from the raw `RankMatrixRow[]` array before rendering — same as current implementation.

### Map panel

`#map { display: none }` added to `src/style.css`. The `initMap` call in `src/charts/init.ts` is kept as-is (renders into a hidden div). The `#map` div remains in `index.html`.

### Layout restructure

Current: `#layout > [#left > (#map + #arc)] + #heatmap`

New: `#layout > #heatmap + #arc` — remove the `#left` wrapper, pull `#arc` out as a direct child of `#layout`. Update CSS:
- `#heatmap`: primary column, `flex: 1.4`, full height, scroll-y
- `#arc`: secondary column, `flex: 1`, full height, `border-left`
- Remove all `#left` and `#map` rules (or leave `#map { display: none }` for the hidden div)

The `initMap` call in `init.ts` requires no change — `getElementById('map')` still resolves (the div exists, just invisible).

`#arc` currently has `height: 220px; flex-shrink: 0` (sized for a stacked row below the map). In the new layout it becomes a full-height right column, so those rules are replaced with `flex: 1; height: 100%`.

---

## Interactions Summary

| Gesture | Effect |
|---|---|
| Hover tile | Cross-lane highlight (gold ring on matching tiles, others faded) |
| Mouseleave | Clear highlight |
| Click tile | Highlight + `setState({ selectedDungeon, selectedSeasonForArc })` |
| Arc legend click | `setState({ selectedSeasonForArc })` — swimlane highlights selected dungeon tiles (unchanged) |
| Select nothing | All tiles at full opacity |

---

## Out of Scope (noted for future)

**Affix overlay on arc chart:** The `keystone_affixes` field is already present in every leaderboard API response. A follow-up task can:
1. Extract `period_id → affixes[]` in the fetch pipeline, stored in `public/data/periods.json`.
2. Shade arc chart week backgrounds by dominant affix (Fortified / Tyrannical / seasonal), enabling players to correlate difficulty spikes with affix rotations.

This is deferred; nothing in the current spec needs to change to support it later.
