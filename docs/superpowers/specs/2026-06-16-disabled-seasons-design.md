# Disabled Seasons Design

**Date:** 2026-06-16  
**Status:** Approved

## Problem

Seasons 5 and 9 only have data for one period each. This single-period sample skews every chart that aggregates or trends data across weeks. The data exists and should be preserved, but should not influence any visualization output.

## Goal

- Keep S5 and S9 rows visible in the dungeon browser so the season history is complete
- Grey them out visually to signal they are disabled
- Exclude their data from all charts (arc, affix, dungeon rankings)

## Approach

Single config constant, filter at each chart layer. Follows the existing `MAX_SEASON` pattern.

## Changes

### `src/config.ts`

Add:
```
export const DISABLED_SEASONS = new Set([5, 9])
```

### `src/charts/dungeon-browser.ts`

- Keep disabled seasons in the render loop (they should still appear)
- When building a lane for a disabled season, add class `lane--disabled`
- When building tiles for a disabled season, add class `tile--disabled` and skip attaching the click handler
- Tiles in disabled lanes should not respond to hover highlight either

### `src/charts/arc.ts`

Add `&& !DISABLED_SEASONS.has(s.id)` to both `manifest.seasons.filter(...)` calls that build the active seasons list (approximately lines 83 and 124).

### `src/charts/affix.ts`

Add `&& !DISABLED_SEASONS.has(s.id)` to the `availableSeasons` filter call.

### `src/style.css`

`.lane--disabled` — reduce overall lane opacity slightly (e.g. `opacity: 0.45`) to signal the row is inactive.

`.tile--disabled` — `pointer-events: none`; `filter: grayscale(1) opacity(0.45)` to desaturate and dim.

## Out of Scope

- Making disabled seasons configurable via UI
- Showing a tooltip explaining why the season is disabled
- Filtering disabled seasons at the DuckDB query level
