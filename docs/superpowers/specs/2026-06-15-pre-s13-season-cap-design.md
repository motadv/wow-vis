# Pre-Season 13 Season Cap — Design Spec

**Date:** 2026-06-15
**Branch:** improve-affix-panel (or new branch)
**Status:** Approved, ready for implementation

---

## Problem

The War Within expansion (Season 13+) changed two fundamental M+ systems:

1. **Primary affixes**: Fortified and Tyrannical are now both active simultaneously in every period, instead of alternating weekly. The Fortified-vs-Tyrannical comparison that drives the stream graph visualization is meaningless for S13+.
2. **Secondary affixes**: Replaced by Xal'atath's Bargain variants — a different system not amenable to the existing impact-delta analysis.

A partial fix (`getPrimaryAffixTrend` War Within branch, stream graph single-line path) was added previously but left dead code and misleading UI in place. The project is a university data visualization course project, not a live Blizzard tool, so there is no need to represent War Within affix data.

**Decision:** Cap the entire application at Season 12. Season 13+ data and dungeons are excluded from all views.

---

## Approach

A single global constant `MAX_SEASON = 12` in `src/config.ts` drives filtering in every view. Dead War Within workaround code in two files is removed cleanly.

---

## Section 1 — Global season cap

### `src/config.ts`

Add:

```typescript
export const MAX_SEASON = 12;
```

### `src/charts/init.ts`

Filter `seasonIds` passed to `getGlobalKeyRange()`:

```typescript
const seasonIds = manifest.seasons
  .filter(s => s.dungeonIds.length > 0 && s.id <= MAX_SEASON)
  .map(s => s.id);
```

### `src/charts/dungeon-browser.ts`

- Filter `manifest.seasons` to `id <= MAX_SEASON` when building the swimlane grid.
- Derive a local `validDungeonIds` set: dungeon IDs that appear in at least one season with `id <= MAX_SEASON`. Filter `manifest.dungeons` against this set before rendering lanes. Purely War Within dungeons (only in S13+) are excluded entirely.

### `src/charts/arc.ts`

Filter the season list used to render arc lines to `id <= MAX_SEASON`.

### `src/charts/map.ts`

Derive its own local `validDungeonIds` set independently (same logic: dungeon IDs active in at least one season `≤ MAX_SEASON` from the manifest). Filter dungeon nodes against this set. War Within-only dungeon nodes do not appear on the map. Each chart derives this set independently from the manifest it receives — no shared state needed.

### `src/charts/affix.ts`

- `getAvailableSeasonsForDungeons()` returns ALL seasons the dungeon was active in (no cap applied here). This preserves S13+ season IDs so the selector can render them as disabled.
- Season selector: for each season ID returned, render normally if `seasonId <= MAX_SEASON`, render disabled (opacity 0.4, `cursor: not-allowed`, `title="Affix analysis not available for War Within seasons"`) if `seasonId > MAX_SEASON`.
- Effective season for queries: cap to `≤ MAX_SEASON`. If the selected season (from state) is `> MAX_SEASON` (shouldn't happen since those buttons are disabled, but defensive), fall back to the most recent available season `≤ MAX_SEASON`.
- "All" behavior: when no season is selected, default to the most recent season `≤ MAX_SEASON` from the dungeon's available seasons.

`src/db/init.ts` (`loadSeason`) requires no change — it loads on demand and will never be called for S13+ seasons since no view requests them.

---

## Section 2 — Remove War Within workaround code

### `src/db/queries.ts` — `getPrimaryAffixTrend()`

Remove:
- `const isWarWithin = seasonId >= 13` check
- The entire War Within branch (combined-median query and its return shape)

Keep only the pre-S13 split-by-`fortified` path. Return type stays `Array<{ period, fortifiedMedian, tyrannicalMedian }>`.

### `src/charts/affix-stream.ts` — `renderStreamGraph()`

Remove:
- The `isWarWithin` detection (`data.some(d => 'combinedMedian' in d && ...)`)
- The single purple line path for War Within data
- The `(d as any).combinedMedian` cast (was always a type smell)

Keep only the stacked area path: blue (`#3b82f6`) for Fortified, orange (`#f97316`) for Tyrannical.

---

## Section 3 — Scope boundaries

**Not changed in this spec:**

- `affix-radial.ts` — works correctly for pre-S13 data as-is.
- `getSecondaryAffixImpact()`, `getAggregateSecondaryAffixImpact()` in `queries.ts` — unchanged.
- `getDungeonAffixTrend`, `getSeasonAffixSnapshot`, `getAffixHeadToHead` in `queries.ts` — not removed (separate refactor if desired).
- `types.ts` — no changes needed. `PrimaryAffixTrendPoint` already only has `fortifiedMedian` and `tyrannicalMedian`; the `combinedMedian` field existed only as an `any` cast in `affix-stream.ts` and is removed with it.
- `arc.ts`, `map.ts` internal logic — unchanged; they just see fewer seasons/dungeons via filtered input.
- Unit tests — all 11 existing tests should pass without modification.

---

## Files changed

| File | Change |
|------|--------|
| `src/config.ts` | Add `MAX_SEASON = 12` |
| `src/charts/init.ts` | Filter `seasonIds` by `MAX_SEASON` |
| `src/charts/dungeon-browser.ts` | Filter seasons and dungeons by `MAX_SEASON` |
| `src/charts/arc.ts` | Filter seasons by `MAX_SEASON` |
| `src/charts/map.ts` | Filter dungeon nodes by `MAX_SEASON` |
| `src/charts/affix.ts` | Filter seasons, disable S13+ buttons |
| `src/db/queries.ts` | Remove War Within branch from `getPrimaryAffixTrend()` |
| `src/charts/affix-stream.ts` | Remove War Within / `combinedMedian` path |
