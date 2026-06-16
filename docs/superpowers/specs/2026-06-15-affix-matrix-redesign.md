# Affix Panel Redesign — Unified Impact Matrix

**Date:** 2026-06-15
**Scope:** Replace the stream graph + radial chart in the affix panel with a single affix impact matrix.

---

## Problem

The current affix panel has two charts that fail to answer meaningful questions:

- **Stream graph (primary affix):** Shows Fortified vs Tyrannical median key level week-by-week within a single season. Because the two affixes alternate every period, the result is a jagged zigzag — no useful pattern is visible.
- **Radial chart (secondary affixes):** Arms-based radial with impact encoded as arm length. Labels are hidden behind hover. The layout conveys neither ranking nor cross-season consistency.

Neither visualization reveals what players actually want to know: *which affixes consistently make this dungeon harder or easier, and by how much?*

---

## Decision

Replace both charts with a single **Affix Impact Matrix** for the selected dungeon (single-dungeon only; multi-dungeon view is dropped).

- **Rows:** All affixes — PRIMARY section (Tyrannical, Fortified) then SECONDARY section (all secondary affixes that appeared in pre-S13 seasons with this dungeon), sorted by `|avgDelta|` descending.
- **Columns:** One column per season where the dungeon was active (pre-S13 only, ascending), plus a highlighted **AVG** column.
- **Cells:** Impact delta — `median_key_when_active − season_baseline`. Positive = easier (players push higher keys), negative = harder.
- **Default state:** AVG column highlighted in purple; rows sorted by `|avgDelta|`.
- **Season drill-down:** Clicking a season column header highlights it in blue, dims the rest, re-sorts rows by `|delta|` for that season, and syncs `selectedSeasonForArc` state.
- **Tooltip on hover:** Exact delta to 2 decimal places, affix name, season context.

---

## Data Model

```typescript
interface AffixMatrixRow {
  affixId: number;
  affixName: string;
  isPrimary: boolean;
  isFortified?: boolean;              // set only on primary rows
  cells: Record<number, number | null>; // seasonId → delta (null = dungeon not in season)
  avgDelta: number;                   // arithmetic mean across seasons with data
}

interface AffixMatrixData {
  dungeonId: number;
  seasonIds: number[];                // seasons where dungeon appears, ascending, pre-S13 only
  rows: AffixMatrixRow[];             // primary rows first, then secondary sorted by |avgDelta| desc
}
```

`avgDelta` is a plain arithmetic mean across seasons where the dungeon was active.

---

## Delta Formula

Same formula for primary and secondary affixes:

```
delta = median_key_when_active − season_baseline
```

where `season_baseline` = overall median key for that dungeon in that season (all periods).

This puts primary and secondary affixes on the same scale, enabling direct magnitude comparison (e.g. "Tyrannical hurts this dungeon more than Bolstering").

---

## New Query Functions (`src/db/queries.ts`)

### `getPrimaryAffixDeltaBySeason(conn, dungeonId, seasonIds)`

For each season, returns `{ seasonId, fortifiedDelta, tyrannicalDelta }`. Uses a single SQL query per season with conditional medians:

```sql
SELECT
  MEDIAN(keystone_level)                                    AS baseline,
  MEDIAN(CASE WHEN fortified     THEN keystone_level END)   AS fort_median,
  MEDIAN(CASE WHEN NOT fortified THEN keystone_level END)   AS tyrant_median
FROM leaderboard_{seasonId}
WHERE dungeon_id = {dungeonId}
```

`fortifiedDelta = fort_median − baseline`, `tyrannicalDelta = tyrant_median − baseline`.

### `getSecondaryAffixImpactAllSeasons(conn, dungeonId, seasonIds)`

Calls the existing `getSecondaryAffixImpact(conn, dungeonId, seasonId)` in parallel for each season, then merges results into `Map<affixId, { name, deltaPerSeason: Record<seasonId, number> }>` and computes `avgDelta`.

---

## Color Scale

Global normalization: `MAX_DELTA = 1.5` (values beyond this clamp to the darkest shade).

| Range (t = delta / MAX_DELTA) | Background | Text |
|---|---|---|
| t ≤ −0.70 | `#7f1d1d` | `#fca5a5` |
| t ≤ −0.45 | `#991b1b` | `#fca5a5` |
| t ≤ −0.15 | `#dc2626` | `#fca5a5` |
| −0.15 < t < 0.08 (neutral) | `#27272a` | `#71717a` |
| t < 0.15 | `#166534` | `#86efac` |
| t < 0.45 | `#15803d` | `#6ee7b7` |
| t < 0.70 | `#059669` | `#6ee7b7` |
| t ≥ 0.70 | `#064e3b` | `#34d399` |

The neutral band is intentionally asymmetric: the negative side extends slightly further (`−0.15`) so small negative deltas (e.g. −0.10) read as grey rather than faintly red.

Cell values displayed to **2 decimal places** with explicit `+`/`−` sign. Null cells (dungeon not active that season) render as a dark background (`#1a1a22`) with a dim `—` placeholder.

---

## Files Changed

| File | Action |
|---|---|
| `src/charts/affix-stream.ts` | Delete |
| `src/charts/affix-radial.ts` | Delete |
| `src/charts/affix-matrix.ts` | Create — `renderAffixMatrix(container, data, width)` |
| `src/charts/affix.ts` | Simplify — remove stream/radial/multi-dungeon paths, use matrix renderer |
| `src/db/queries.ts` | Add `getPrimaryAffixDeltaBySeason`, `getSecondaryAffixImpactAllSeasons` |
| `src/types.ts` | Add `AffixMatrixRow`, `AffixMatrixData` interfaces |

The season selector strip at the top of the affix panel is removed; season selection is handled via matrix column header clicks.

---

## Known Follow-ups (out of scope here)

- **Font size overhaul:** Cell and label font sizes are acknowledged as too small. A separate typography pass will address readability across the whole dashboard.
- **Multi-dungeon view:** Dropped for simplicity. Could be revisited as a future feature (e.g. side-by-side matrices or an averaged aggregate row).
- **War Within seasons (S13+):** Remain disabled — the affix system changed in S13 (both Fortified and Tyrannical active simultaneously), making the delta formula incompatible.
