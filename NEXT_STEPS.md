# Next Steps

## Design artifacts

- **Spec:** `docs/superpowers/specs/2026-05-09-wow-mythic-dungeon-analysis-design.md`
- **Implementation plan:** `docs/superpowers/plans/2026-05-09-wow-mythic-dungeon-analysis.md`

## Before writing any code

1. **Download the world map** — get a high-res Azeroth map PNG from WoW Wiki and save it as `public/map.png`.
2. **Confirm Blizzard credentials** — ensure `.env` has valid `VITE_BLIZZARD_CLIENT_ID` and `VITE_BLIZZARD_CLIENT_SECRET` (see `.env.example`).

## Implementation order

Follow the plan task by task (`docs/superpowers/plans/2026-05-09-wow-mythic-dungeon-analysis.md`):

1. Tasks 1–3 → project setup, types, dashboard HTML
2. Tasks 4–7 → offline data pipeline; run `npm run fetch` at the end and manually fill `era`, `mapX`, `mapY`, `offWorld` in `public/data/dungeons.json`
3. Tasks 8–16 → in-browser DuckDB, query functions, all visualization components

## Research question priority

Both questions A (era → adoption) and B (reintroduction → key ceiling) are implemented. **B is preferred** if scope forces dropping one — change the default `viewMode` in `src/state.ts` from `'era'` to `'reintroduction'` to reflect this.

## Stretch goal

Regional heatmap (D3 radial gradients or canvas kernel density over the map) — implement only after the core A+B system is stable and verified.
