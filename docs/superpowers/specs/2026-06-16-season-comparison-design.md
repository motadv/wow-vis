# Season Comparison View — Design Spec

**Date:** 2026-06-16
**Feature:** Per-season dungeon comparison in the arc panel

## Overview

When multiple dungeons are selected, the arc panel currently shows an overview of all dungeons across all their seasons. This feature adds the ability to select a shared season (one where all selected dungeons were active) and view a focused comparison for that season — showing which dungeon was harder each week and why, with affix context on hover.

## Architecture & Integration

All changes are confined to `src/charts/arc.ts`. No new global state is added to `src/state.ts` — the selected comparison season is panel-local state, since no other chart needs to know about it.

`comparisonSeasonId: number | null` lives in the `initArc` closure alongside `lastSelectionKey`, `lastMultiData`, etc. — not inside `renderMultiArc`, which is called on every re-render and would reset it. It resets to `null` whenever the dungeon selection changes (detected by `selectionKey` changing).

Flow:

1. `renderMultiArc` is called when 2+ dungeons are selected (unchanged trigger)
2. It computes shared seasons — the intersection of active seasons across all selected dungeons, excluding `DISABLED_SEASONS` and seasons beyond `MAX_SEASON`
3. If at least one shared season exists, a chip row is rendered below the title
4. `comparisonSeasonId` (closure-scoped) tracks which chip is active
5. `null` → render existing overview chart (current behavior, unchanged)
6. Set → render comparison view for that season

One new DB query is needed: `getWeeklyAffixes` is NOT needed. Per-week affix lookups come from the already-loaded affix manifest (`getAffixManifest()`), which maps `seasonId → { periodId → affixIds[] }`.

`getSecondaryAffixImpact` is reused per dungeon when a comparison season is first selected, then cached so switching back and forth is instant.

## Shared Season Chips

A chip row appears below the panel title when 2+ dungeons are selected and at least one shared season exists. Each chip shows the season label (e.g. "S7", "S9").

- A season qualifies if ALL selected dungeons have it in their `dungeonIds`, it is not in `DISABLED_SEASONS`, and it is `<= MAX_SEASON`
- Clicking an inactive chip sets `comparisonSeasonId` and re-renders in comparison mode
- Clicking the active chip clears `comparisonSeasonId` and returns to overview
- Active chip gets a distinct border/fill matching the existing UI highlight style
- If no shared seasons exist, the chip row is omitted with no empty space

## Comparison View

When a chip is active, the arc panel renders a focused single-season chart replacing the overview.

- **Title**: updated to e.g. `"Season 9 — Dungeon Comparison"`
- **X-axis**: weeks (period_index) for that season, same scale and style as existing arc chart
- **Y-axis**: same `keyDomain` range as overview for visual consistency
- **N lines**: one per dungeon, full opacity, using `dungeonColor(i)`. No faded per-season variants — there is only one season
- **Leader ribbon**: a thin strip (~8px tall) sitting between the X-axis line and the tick labels, spanning the full chart width. Each weekly segment is filled with the color of whichever dungeon had the highest `median_key` that week. Ties go to the first dungeon in selection order

## Hover Tooltip

On hover in the comparison view, a vertical crosshair snaps to the nearest week. The tooltip shows:

**Header:** Week number (period_index)

**Dungeon ranking table:** All N dungeons listed in descending order by median key for that week. Each row shows:
- Dungeon color dot
- Dungeon name
- Median key level
- Top dungeon gets a subtle highlight

**Affix section:** Affixes active that week, from `getAffixManifest()[seasonId][periodId]`. Displayed as colored badges using `getAffixColor()`:
- Fortified → blue (`#3b82f6`)
- Tyrannical → orange (`#f97316`)
- Secondary affixes → colored by impact delta via `cellStyle()`, same as the single-dungeon tooltip

**Impact delta per dungeon:** For each secondary affix shown, display the `impactDelta` from `getSecondaryAffixImpact` for each dungeon side by side — e.g. a small annotation showing each dungeon's delta relative to its baseline. This shows whether a given affix made a dungeon harder or easier compared to its average.

Tooltip positioning uses the same overflow-aware boundary clamping already in the arc chart.

## Data Loading

- `getWeeklyArc` is already loaded for all selected dungeons per their active seasons in `renderMultiArc`; the comparison view reuses this cached data filtered to the selected season
- `getSecondaryAffixImpact` is called once per `(dungeonId, seasonId)` pair when a comparison season chip is first clicked, results cached in a `Map<string, SecondaryAffixImpactMap>` keyed by `"${dungeonId}:${seasonId}"` so switching between chips uses the correct data without re-fetching
- Affix-per-period lookup uses `getAffixManifest()` (already loaded at init time) — no new query needed

## Out of Scope

- Comparison view for single-dungeon selection (no chips rendered)
- Exporting or sharing the comparison view
- Animating transitions between overview and comparison mode
