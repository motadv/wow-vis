# Dungeon Browser Search Bar — Design Spec

**Date:** 2026-06-16  
**Status:** Approved

## Overview

Add a search input to the dungeon browser panel that highlights all tiles whose dungeon name matches the query, fading non-matching tiles. Matching is purely visual — no state changes, no selection side effects.

## Placement

A `<input type="search" placeholder="Search dungeons…">` is inserted between the subtitle element and the lanes container (`.dungeon-browser-lanes`). Styled to fit the dark panel theme.

## Matching Logic

- Match against `dungeon.name` (full name, not the abbreviation shown on the tile).
- Case-insensitive substring match.
- Empty query = search not active; all tile classes revert to selection-only logic.

## Tile Class Reconciliation

A single `applyTileClasses()` function replaces the current inline `subscribe` callback logic. It is called both by the state subscriber and by the search input's `input` event handler.

| Condition | Classes |
|---|---|
| Tile is selected | `tile--selected` |
| Search active, tile matches, not selected | `tile--highlighted` |
| Search active, tile does not match, not selected | `tile--faded` |
| No search, selection exists, tile not selected | `tile--faded` |
| No search, no selection | *(none)* |

Selected tiles are never faded or highlighted by search — they keep `tile--selected` regardless.

## Hover Interaction

While a search query is non-empty, `mouseenter`/`mouseleave` handlers skip `applyHighlight`/`clearHighlight` so hover does not override the search highlight. Hover resumes normally when search is cleared.

## Lane Fading

Lane-level fading (`.lane--faded`) is **not** applied during search. Multiple dungeons can appear across all lanes, making lane fading misleading. Lane fading from hover still applies when search is empty.

## Subtitle Counter

The subtitle text does **not** change based on search state (it already changes based on selection count). No new counter needed.

## Files Changed

- `src/charts/dungeon-browser.ts` — add input element, `applyTileClasses()` function, wire input event, guard hover handlers.
- `src/style.css` — add styling for the search input (dark background, border, focus ring consistent with panel theme).

## Out of Scope

- No fuzzy matching; plain `includes()` is sufficient.
- No search result count indicator.
- No keyboard navigation of results.
- No interaction with global state (`state.ts` unchanged).
