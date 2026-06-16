# Multi-Dungeon Selection — Design Spec

**Date:** 2026-06-16  
**Branch:** feature/improve-affix-view  

---

## Problem

Multi-dungeon selection is broken in two ways:

1. **Arc chart goes blank** — `toggleDungeonSelection` sets `selectedDungeon = null` when 2+ dungeons are selected. The arc chart watches only `selectedDungeon`, so it renders the empty-state message whenever more than one dungeon is active.
2. **Affix panel refuses multi-dungeon input** — `affix.ts` explicitly guards on `selectedDungeons.length === 1` and shows "Select a single dungeon," even though the query layer already supports multiple dungeon IDs.

Root cause: `AppState` has two parallel fields (`selectedDungeon: number | null` and `selectedDungeons: number[]`) that are kept in sync manually and disagree as soon as more than one dungeon is selected.

---

## Approach

Remove `selectedDungeon` entirely. All consumers read `selectedDungeons` directly and branch on its length. Single source of truth, no aliasing.

---

## Section 1 — State (`src/state.ts`, `src/types.ts`)

- Remove `selectedDungeon` from `AppState` interface and initial state.
- `toggleDungeonSelection(id)` — existing toggle logic, no changes needed, except add a **cap of 4**: if `selectedDungeons.length === 4` and `id` is not already in the set, the call is a no-op.
- Add `selectOnlyDungeon(id: number)` helper — sets `selectedDungeons: [id]` and clears `selectedSeasonForArc: null` in one `setState` call. Used by the map on click (replaces the current `setState({ selectedDungeon })` call).

---

## Section 2 — Map (`src/charts/map.ts`)

- Replace `setState({ selectedDungeon: d.id, selectedSeasonForArc: null })` with `selectOnlyDungeon(d.id)`.
- Visual feedback: read `state.selectedDungeons.includes(d.id)` instead of `d.id === state.selectedDungeon`.
- Selected dot: white ring (existing behavior, no change needed).
- Faded dot: any dot not in `selectedDungeons` when the set is non-empty gets `opacity: 0.5`.

---

## Section 3 — Dungeon Browser (`src/charts/dungeon-browser.ts`, `src/style.css`)

**Tile highlight scheme:**

| State | Background | Text |
|-------|-----------|------|
| Hovered | white (`#ffffff`) | dark (`#18181b`) |
| Selected | yellow (`#eab308`) | dark (`#18181b`) |
| Normal (nothing selected) | era color | inherit |
| Normal (something selected, this tile not) | era color, `opacity: 0.6` | inherit |

- Update `.tile--selected` CSS: yellow background, dark text, no outline.
- Update `.tile--highlighted` CSS (hover): white background, dark text.
- Add subtitle counter showing selection count: `"2 / 4 selected"` when any dungeons are selected, otherwise the existing subtitle text. Update this counter in the `subscribe` handler.
- The cap-of-4 is enforced in state — no UI needed beyond the counter making the limit visible.

---

## Section 4 — Arc Chart (`src/charts/arc.ts`)

### Single mode (`selectedDungeons.length === 1`)

Behavior unchanged from current. Color by season (tableau10 by season index). Title = dungeon name.

### Multi mode (`selectedDungeons.length > 1`)

**Color assignment:** Each dungeon gets `d3.schemeTableau10[index % 10]` where `index` is its position in `selectedDungeons`. Imported from shared `src/utils/colors.ts`.

**Per-season lines:** Thin (`stroke-width: 1.5`), dungeon color at 35% opacity. Show seasonal spread without dominating the chart.

**Average line per dungeon:** Computed by grouping all seasons' rows by `period_index` and averaging `median_key` across seasons that have data for that week. Drawn at stroke-width 3, full opacity, with filled circle markers (r=4) at each week. This is the primary comparison artifact.

**Title:** `"N Dungeons — Median Key Level per Week"` (N = count).

**Legend:** Row of colored dot + dungeon name, one per selected dungeon, shown below the title bar.

**Season emphasis (`selectedSeasonForArc`):** Disabled in multi mode. The "View All" button and season-click interaction are suppressed when `selectedDungeons.length > 1`.

**Cache invalidation:** Current cache uses `lastDungeonId: number | null`. Replace with `lastSelectionKey: string` — `selectedDungeons.slice().sort().join(',')`. Refetch only when this key changes.

**Data fetching:** For each dungeon in `selectedDungeons`, fetch all seasons where it appears (same logic as single mode, per-dungeon). Results keyed by `dungeonId`.

---

## Section 5 — Affix Panel (`src/charts/affix.ts`)

### Single mode (`selectedDungeons.length === 1`)

Behavior unchanged from current.

### Multi mode (`selectedDungeons.length > 1`)

Render one full affix matrix per dungeon, stacked vertically in the `#affix` container.

Each dungeon block:
- Header: dungeon name in its arc color (same `dungeonColor(index)` from `src/utils/colors.ts`).
- Full affix matrix with that dungeon's own available seasons (no intersection — each dungeon shows its own season columns).
- Data fetched independently: `getPrimaryAffixDeltaBySeason` + `getSecondaryAffixImpactAllSeasons` per dungeon.

**Empty state:** Unchanged — "Select a dungeon to analyze affixes." when `selectedDungeons.length === 0`.

**Cache invalidation:** Same `lastSelectionKey` pattern as arc — re-render when the sorted set changes.

---

## Section 6 — Shared Color Utility (`src/utils/colors.ts`)

New file. Exports:

```ts
export function dungeonColor(index: number): string
```

Returns `d3.schemeTableau10[index % 10]`. Both arc and affix import this and index by position in `selectedDungeons`. Guarantees color consistency across panels.

---

## Files to Change

| File | Change |
|------|--------|
| `src/types.ts` | Remove `selectedDungeon` from `AppState` |
| `src/state.ts` | Remove field, add `selectOnlyDungeon`, add cap-of-4 to `toggleDungeonSelection` |
| `src/charts/map.ts` | Use `selectOnlyDungeon`, read `selectedDungeons` for visual feedback |
| `src/charts/dungeon-browser.ts` | Yellow/white tile highlights, selection counter |
| `src/style.css` | Update `.tile--selected` and `.tile--highlighted` styles |
| `src/charts/arc.ts` | Multi mode: dungeon colors, per-season thin lines, thick average line, legend |
| `src/charts/affix.ts` | Multi mode: one matrix per dungeon, stacked |
| `src/utils/colors.ts` | New file: `dungeonColor(index)` |

---

## Out of Scope

- Aggregated affix matrix across dungeons (decided against during design).
- Season intersection filtering (each dungeon shows its own seasons).
- Season emphasis (`selectedSeasonForArc`) in multi mode.
