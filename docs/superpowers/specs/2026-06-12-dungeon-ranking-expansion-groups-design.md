# Dungeon Ranking — Expansion Group Headers

## Goal

Replace the flat per-season lane list with expansion-grouped sections. Each expansion gets a heading with its full name; seasons are listed as children with "Season N" labels. Visual separators divide expansion groups.

## Scope

Two files: `src/charts/heatmap.ts` and `src/style.css`. No changes to types, queries, or state.

## Data & Grouping

Replace `seasonAbbrev()` with two helpers:

- `expansionName(season: SeasonMeta): string | null` — extracts the expansion name from the season name string (e.g. `"The War Within"` from `"Mythic+ Dungeons (The War Within Season 2)"`). Returns `null` for unparseable names.
- `seasonLabel(season: SeasonMeta): string` — returns `"Season N"` from the same string. Falls back to `S${season.id}` if unparseable.

Before rendering, group the filtered `seasons` array into a `Map<string, SeasonMeta[]>` keyed by expansion name, preserving chronological order. Seasons with `expansionName === null` are skipped silently (already filtered by `dungeonIds.length > 0`, so this is a belt-and-suspenders guard).

## DOM Structure

Inside `.heatmap-lanes`, for each expansion group:

1. Insert a `.expansion-header` div with the full expansion name.
2. Render each season's `.lane` as before, using `seasonLabel()` for `.lane-label`.

The first expansion group has no top separator. Subsequent groups get `margin-top` + a top border on the `.expansion-header`.

## CSS

New class `.expansion-header`:
- Font size ~12px, uppercase, muted color (`#52525b`)
- `padding: 14px 0 4px` (first group: `padding-top: 4px`)
- `border-top: 1px solid #27272a` on all groups except the first

Update `.lane-label`:
- Width from `52px` → `68px` to fit "Season 10" without wrapping.

Existing lane, tile, and tooltip selectors are unchanged.

## Behavior

- Hover highlight and click-to-select behavior on tiles is unchanged.
- State subscription (`.tile--selected` sync) is unchanged.
- Era legend below the lanes is unchanged.
