# Detail Panel Redesign

**Date:** 2026-05-10  
**Branch:** demo  
**Scope:** `src/style.css`, `src/charts/detail/index.ts`, `src/charts/detail/era.ts`, `src/charts/detail/reintroduction.ts`

---

## Problem

The detail panel lives as a flex sibling to `#map` inside `#middle`. When it opens, the map shrinks from full width to `calc(100% - 384px)`, causing a layout shift. Both charts inside the panel lack proper axes, making distributions and values hard to read.

---

## Design Decisions

| Decision | Choice |
|---|---|
| Panel positioning | `position:absolute` on `#middle` — overlaps map, no layout shift |
| Panel open/close | CSS `transform: translateX` transition (not display toggle) |
| Chart subtitles | None — clean axes only |
| Reintroduction layout | Vertical stack, full panel width per histogram |

---

## Section 1 — Panel Positioning

### CSS (`src/style.css`)

- `#middle` gains `position: relative`.
- `#detail` changes from a flex child to `position: absolute; top: 0; right: 0; bottom: 0; width: 384px`.
- Remove `display: none` / `display: block` — instead use `transform`:
  - Closed (default): `transform: translateX(100%)`
  - Open (`.open` class): `transform: translateX(0)`
- Add `transition: transform 0.25s ease` to `#detail`.
- Add `pointer-events: none` to `#detail` default; `pointer-events: auto` on `#detail.open`.
- Keep `overflow-y: auto` and `background`/`border-left` as-is.

### `src/charts/detail/index.ts`

No logic changes needed — `classList.add('open')` and `classList.remove('open')` continue to work. The CSS class now triggers a transform instead of a display toggle.

---

## Section 2 — Era Chart (`src/charts/detail/era.ts`)

### Margin changes

Increase bottom margin from `8` to `32` to accommodate x-axis and axis label. Increase `labelW` from `96` to `104` to prevent long era names from clipping.

### Gridlines

Before rendering bars, append vertical `<line>` elements at each x-axis tick position. Style: `stroke: #27272a`, `stroke-width: 0.5`, spanning the full chart height.

### X-axis

Append a D3 `axisBottom(xScale)` with `.ticks(4)` and `.tickFormat(d3.format('~s'))` (e.g. `1k`, `2k`). Style tick lines and text to match the dark theme (`fill: #52525b`, `stroke: #3f3f46`).

Add an axis label `<text>` centered below the axis: "Avg completions", `fill: #52525b`, `font-size: 11`.

### White overlay opacity

Increase from `0.18` to `0.28` for the selected dungeon's indicator rectangle.

---

## Section 3 — Reintroduction Chart (`src/charts/detail/reintroduction.ts`)

### Layout

Replace the `flex-wrap` div (2-per-row) with a vertical stack: `display: flex; flex-direction: column; gap: 20px; padding: 12px 16px`.

### Per-panel structure

Each season snapshot renders:

1. **Header row** (`display: flex; justify-content: space-between`):
   - Left: colored label (`First Appearance` in `#60A5FA` or `Reintroduction` in `#A78BFA`), bold, 11px.
   - Right: `max N · n=M` in `#71717a`, 10px.
2. **Season name**: muted subline below header, `#71717a`, 10px.
3. **SVG histogram**: width = `container.clientWidth - 32`, height = `90px`.
   - X domain shared across all panels (same `[minKey, maxKey]`).
   - Y domain scaled independently per panel.
   - Bars styled with panel color at 80% opacity.
4. **Gridlines**: 3 horizontal lines at 25%, 50%, 75% of chart height (`stroke: #27272a`, `stroke-width: 0.5`), drawn behind bars.
5. **X-axis**: D3 `axisBottom` with ~5 ticks at round key levels. Remove default domain line; keep ticks styled `#52525b`.
6. **Axis label**: "Key level" centered below x-axis, `fill: #52525b`, `font-size: 10`.

### Unchanged

- "Always in pool" warning banner at top.
- Empty-state message.
- Blue (`#60A5FA`) / purple (`#A78BFA`) color scheme.
