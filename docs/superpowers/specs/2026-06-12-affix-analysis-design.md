# Affix Analysis Panel — Design Spec

**Date:** 2026-06-12

## Overview

Add a dedicated affix analysis panel to the dashboard. Users can explore how Fortified, Tyrannical, and secondary rotating affixes impact keystone progression — across dungeons, across seasons, and within a single season. The panel is a three-lens comparison tool: each lens answers a distinct analytical question using contextual filters and an adaptive chart.

---

## Data Pipeline Changes

### 1. `fortified` column in Parquet

Every `LeaderboardEntry` row gains a `fortified: boolean` field derived from `keystone_affixes` in the Blizzard API leaderboard response. Affix ID `10` = Fortified; its absence means the week was Tyrannical.

**Files modified:**
- `scripts/fetch/types.ts` — add `fortified: boolean` to `LeaderboardEntry`; add `AffixEntry` (`{ id: number; name: string }`) and `AffixManifest` (`{ [seasonId: number]: { [periodId: number]: AffixEntry[] } }`) types; update `BlizzardLeaderboard` to include `keystone_affixes: Array<{ keystone_affix: { id: number; name: string }; starting_level: number }>`
- `scripts/fetch/transform.ts` — derive `fortified` from `raw.keystone_affixes` in `transformLeaderboard`
- `scripts/fetch/write.ts` — add `fortified` BOOLEAN column to Parquet schema; add `writeAffixManifest(manifest: AffixManifest)` function that writes `public/data/affixes.json`
- `scripts/fetch/index.ts` — accumulate period→affix data during the leaderboard fetch loop; call `writeAffixManifest` after all seasons are processed

The full pipeline must be re-run (`npm run fetch`) to regenerate all Parquet files with the new column.

### 2. `public/data/affixes.json`

A static manifest written by the pipeline. Shape:

```json
{
  "6": {
    "456": [{ "id": 10, "name": "Fortified" }, { "id": 11, "name": "Bursting" }],
    "457": [{ "id": 9, "name": "Tyrannical" }, { "id": 7, "name": "Bolstering" }]
  }
}
```

Keys are season ID → period ID → full affix list for that week. Loaded by the browser at startup alongside `dungeons.json`.

---

## Browser Architecture

### New / modified files

| File | Change |
|------|--------|
| `src/types.ts` | Add `AffixEntry`, `AffixManifest` types (mirror of pipeline types) |
| `src/db/init.ts` | Fetch and parse `affixes.json`; expose `affixManifest` on the db context object |
| `src/db/queries.ts` | Three new query functions (see Query Layer below) |
| `src/state.ts` | Add `affixLens` and `affixFilters` state fields |
| `src/charts/affix.ts` | New chart module — exports `initAffixChart()` |
| `src/charts/init.ts` | Call `initAffixChart()` in startup sequence |
| `index.html` | Wrap `#arc` and `#affix` in a `#right` column div |
| `src/style.css` | Layout styles for `#right`, `#affix`; affix panel component styles |

### State additions (`src/state.ts`)

```ts
affixLens: 'trend' | 'snapshot' | 'headtohead'   // active lens; default 'trend'
affixFilters: {
  dungeonId: number | null       // lens 1 + 3
  seasonId: number | null        // lens 2 + 3; defaults to selectedSeason
  fortified: boolean | null      // lens 3 only; null = both
  secondaryAffixId: number | null // lens 1 + 2; null = all weeks
}
```

Switching lens resets `secondaryAffixId` and `fortified` but preserves `dungeonId` and `seasonId`.

### Query layer (`src/db/queries.ts`)

**`getDungeonAffixTrend(conn, dungeonId, seasonIds, periodIds?)`**
Returns median keystone level grouped by `season_id` and `fortified`. The optional `periodIds` array is resolved in JS from the affix manifest before calling (when a secondary affix chip is active); omitting it includes all weeks.

```sql
SELECT season_id, fortified, MEDIAN(keystone_level) AS median_key
FROM leaderboard_<N>  -- one UNION ALL per season
WHERE dungeon_id = ?  [AND period IN (?)]
GROUP BY season_id, fortified
ORDER BY season_id ASC
```

**`getSeasonAffixSnapshot(conn, seasonId, periodIds?)`**
Returns median keystone level grouped by `dungeon_id` and `fortified` for a single season.

```sql
SELECT dungeon_id, fortified, MEDIAN(keystone_level) AS median_key
FROM leaderboard_<N>
[WHERE period IN (?)]
GROUP BY dungeon_id, fortified
```

**`getAffixHeadToHead(conn, dungeonId, seasonId, periodIdsByAffix)`**
`periodIdsByAffix` is a `Map<affixId, periodId[]>` built from the affix manifest in JS. Runs one sub-query per affix group and UNIONs the results.

```sql
SELECT <affixId> AS affix_id, MEDIAN(keystone_level) AS median_key
FROM leaderboard_<N>
WHERE dungeon_id = ? AND period IN (?) [AND fortified = ?]
```

### Chart module (`src/charts/affix.ts`)

Exports `initAffixChart(conn, manifest, affixManifest)`. Subscribes to `affixLens` and `affixFilters` state changes. On change, re-queries and re-renders.

Three render functions — one per lens — each producing a grouped bar chart using D3:
- `renderTrend()` — X axis: seasons; two bars per group (Fortified, Tyrannical)
- `renderSnapshot()` — X axis: dungeon abbreviations; two bars per group
- `renderHeadToHead()` — X axis: secondary affix names; one bar per affix; color by Fortified/Tyrannical split

All three share: a lens tab strip at the top, a filter row below it, and the chart area below that. Tooltip on hover shows exact median key value.

---

## Layout

The right half of the dashboard is split vertically:

```
#layout (flex row)
├── #heatmap  (flex 1.2, full height, scrollable)
└── #right    (flex 1, flex column)
    ├── #arc   (flex 1)
    └── #affix (flex 1)
```

`#right` is a new wrapper div introduced in `index.html`. Both `#arc` and `#affix` get equal vertical space. `#affix` has `overflow-y: auto` to handle tall filter strips.

The arc chart SVG currently sizes to fill the full right-column height. Moving it into the split layout halves its available height — `initArcChart` must re-derive dimensions from the `#arc` container at init time (it already does via `getBoundingClientRect`), so no logic change is needed, just a CSS height constraint on `#arc`.

---

## Data Flow Summary

```
affixes.json ──────────────────────────────────────────────────────► affixManifest
                                                                           │
state.affixLens + state.affixFilters ──► JS resolves period IDs from manifest
                                                    │
                                                    ▼
                              DuckDB query (leaderboard_N parquet)
                                                    │
                                                    ▼
                                         affix chart re-render
```

---

## Out of Scope

- Affix analysis on the heatmap or arc chart (those charts are not modified)
- Cross-season secondary affix comparisons (affix pools differ per season; head-to-head lens is scoped to a single season)
- Affix data for seasons 1–5 (no leaderboard data retained by Blizzard)
