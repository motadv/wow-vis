---
name: arc-tooltip-multi-season
description: When no season is emphasized in the arc chart, show a combined tooltip with all seasons' data for the hovered week
metadata:
  type: project
---

# Arc Chart — Multi-Season Tooltip Design

## Problem

When no season is emphasized (`selectedSeasonForArc === null`), the arc chart tooltip currently falls back to the arc with the most rows and shows only that season's data. This is confusing because the displayed season doesn't correspond to what the user is hovering.

## Goal

When no season is emphasized, hovering the arc chart shows a single combined tooltip card with data for every season that has a data point at the hovered week.

## Behavior

### Tooltip modes

`drawTooltip` branches on `emphasizedSeasonId`:

- **`emphasizedSeasonId !== null`** — existing behavior, no change. Single-season tooltip with key value and affixes.
- **`emphasizedSeasonId === null`** — new multi-arc path.

### Multi-arc tooltip (no season selected)

On each `mousemove`:

1. Compute `period_index` from mouse X: `Math.round(xScale.invert(mx))`, clamped to `[1, maxPeriods]`.
2. For each arc in `arcs`, find the row matching that `period_index` (exact match preferred; skip if none).
3. Sort collected (arc, row) pairs by `median_key` descending.
4. Render a single combined tooltip card:

```
Week 5
────────────────────
● S13   +24.3
  Fortified  Tyrannical  Xal'atath
────────────────────
● S14   +22.1
  Fortified  Bolstering
────────────────────
● S12   +19.8
  Tyrannical  Bursting
```

- **Header:** `Week N` — same style as current (small, uppercase, muted).
- **Per-season block:** colored dot + season label + key value on line 1; affix tags (same color-coding as current single-season tooltip) on line 2.
- **Separator:** thin horizontal rule (`border-top: 1px solid #3f3f46`) between season blocks.
- Seasons with no row at the hovered week are omitted entirely.

### Hover indicators

- Pre-create one `circle` per arc (all hidden at `r=0`).
- On each mousemove (no selection), position and show each circle at that arc's y-position for the hovered week.
- On mouseleave, hide all circles.
- In the single-season mode, the existing single `hoverCircle` is used as before.

### Click behavior

Unchanged: clicking the SVG area calls `nearestArc(mx, my)` and sets `selectedSeasonForArc`.

## Scope

- Affix info is shown in the combined card (one color-coded affix tag row per season block).
- No affix impact delta (`secondaryAffixImpact`) shown in multi-arc mode — that data is only loaded for single-dungeon selection and would be absent in multi-dungeon mode. Show plain affix name colors (Fortified = blue, Tyrannical = orange, others = muted) when impact delta is unavailable.
- No key color-coding (relative to season median) in multi-arc mode — computing per-season medians is feasible but adds complexity for limited benefit. Show key value in neutral white.

## Files Changed

- `src/charts/arc.ts` — `drawTooltip` function only.
