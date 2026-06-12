# Arc Chart Improvements Design

**Date:** 2026-06-12  
**File:** `src/charts/arc.ts`  
**Approach:** Split `renderArc` into focused sub-functions (B)

## Feature Set

Eight improvements to the median key level per week (arc) chart:

1. **Season-end vertical markers** — dashed vertical line in the season's color at the last data point of each line. Signals to unfamiliar users why a line stops before the chart's right edge.
2. **Detailed card tooltip** — floating card on hover, snapping to the nearest week via D3 bisect on an invisible overlay `<rect>`. Shows: week number, median key level (+N.N), season name with a color dot.
3. **X-axis label** — "Week of Season" centered below the tick labels.
4. **Larger axis fonts** — tick labels 10 → 12px; axis title labels 10 → 12px.
5. **Dot markers on data points** — `r=3` circles at every weekly data point on all season lines.
6. **Peak annotation** — "▲ +N" label above the highest-key point of the emphasized season. Only shown when a season is emphasized (clicking a legend/line sets this); hidden in the all-equal view to avoid clutter across many seasons.
7. **End-of-line season labels** — season abbreviation (e.g. "TWW S1") printed just past the last data point of each line, replacing the right-side legend. Right margin shrinks from 140px → ~20px.
8. **Horizontal grid lines** — subtle `#27272a` horizontal guides at each Y-axis tick, behind all lines.

## Code Structure

`renderArc` is split into sub-functions, all called in sequence. `initArc` is unchanged.

### `drawAxes(g, xScale, yScale, height, width)`
- Renders X axis (bottom) and Y axis (left) with D3 axis generators
- Adds tick styling: fill `#a1a1aa`, font-size 12px
- Adds axis domain lines: stroke `#3f3f46`
- Adds X-axis label "Week of Season" centered below ticks
- Adds Y-axis label "Median Key" rotated -90°
- Adds horizontal grid lines at each Y tick: stroke `#27272a`, no pointer events

### `drawLines(g, arcs, xScale, yScale, emphasizedSeasonId, colors)`
- Renders one `<path>` per season (existing logic, unchanged curve/emphasis behavior)
- Adds `r=3` dot markers (`<circle>`) at each data point
- Adds season-end dashed vertical line: stroke matches season color, `stroke-dasharray: 4,3`, opacity 0.7
- Adds end-of-line season label to the right of the last dot (replaces legend)
- Adds peak annotation only when `emphasizedSeasonId !== null`: finds `max(median_key)` in that season's rows, places "▲ +N.N" text 14px above the peak dot

### `drawTooltip(g, arcs, xScale, yScale, width, height, emphasizedSeasonId, colors, container)`
- Appends an invisible `<rect>` over the full plot area to capture mouse events
- On `mousemove`: uses `d3.bisect` on a sorted array of period indices to find the nearest week
- Resolves tooltip data from the emphasized season if one is selected; otherwise picks the season with the most weeks (longest, i.e. `maxPeriods`)
- Creates/updates a floating `<div>` tooltip card (positioned absolutely within `container`) with:
  - Header: "Week N" (small uppercase, muted)
  - Key value: "+N.N" (large, season color)
  - Season name with matching color dot
- On `mouseleave`: hides the tooltip

### `legendG` (removed)
The `legendG` block in `renderArc` is deleted. End-of-line labels (in `drawLines`) replace it.

## Layout Changes

| | Before | After |
|---|---|---|
| `MARGIN.right` | 140 | 20 |
| Axis font-size | 10px | 12px |
| Y-axis label font-size | 10px | 12px |

## Season Abbreviation Helper

A `seasonAbbrev(season)` helper already exists in `heatmap.ts`. It is duplicated (or extracted to a shared location) so `arc.ts` can use the same format (e.g. "TWW S1") for end-of-line labels.

**Decision:** Duplicate into `arc.ts` for now (same shape, same logic). If a third chart needs it, extract to `src/utils/season.ts` at that point.

## Tooltip Positioning

- Default: card appears 12px right of the hovered x position, top-aligned to the plot area
- Flip: if the card would overflow the container's right edge, position it 12px to the left of the hovered x
- The card is a `<div>` appended to `container` (not inside the SVG), positioned absolutely

## Peak Annotation Detail

- Scans `rows` for the entry with maximum `median_key`
- Places `"▲ +{value.toFixed(1)}"` text 14px above the dot (i.e. `yScale(peak.median_key) - 14`)
- Font-size 11px, fill = season color, font-weight 700
- Only rendered for emphasized season when `emphasizedSeasonId !== null`; rendered for all seasons when `null`
