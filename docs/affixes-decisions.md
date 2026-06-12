# Affix Analysis — Design Decisions

## Scope

- Analyze both **Fortified/Tyrannical** (primary affix rotation) and **secondary rotating affixes** (Storming, Raging, Bolstering, etc.)
- Feature surfaces as a **new dedicated panel** — existing charts (heatmap, arc) are not modified
- Primary metric: **median keystone level** per affix condition (not a delta view)

## Data collection

- **Re-run the full fetch pipeline** to regenerate all Parquet files with a new `fortified: boolean` column
- Also write a new static manifest `public/data/affixes.json` mapping `season_id → period_id → [{ id, name }]` for secondary affix resolution
- Affix data for seasons 1–5 is out of scope (Blizzard doesn't retain leaderboard data for those)

## Interaction model

- **Lens + contextual filters**: user picks a lens (what question am I asking?), and only the relevant filters for that lens are shown
- Switching lens resets secondary filters (`secondaryAffixId`, `fortified`) but preserves `dungeonId` and `seasonId`

## Three lenses

| Lens | X axis | Filters | Answers |
|------|--------|---------|---------|
| Dungeon over time | Seasons | Dungeon picker, secondary affix chips | How has affix impact on this dungeon changed across seasons? |
| Season snapshot | Dungeon abbreviations | Season picker, secondary affix chips | Which dungeon is most affix-sensitive this season? |
| Affix head-to-head | Secondary affix names | Dungeon picker, season picker, Fort/Tyrant toggle | Does Storming or Raging hurt more on Tyrannical weeks? |

All lenses: grouped bars (red = Fortified, blue = Tyrannical), tooltip on hover shows exact median key.

## Layout

Right column split vertically — arc chart on top half, affix panel on bottom half:

```
#layout (flex row)
├── #heatmap  (flex 1.2, full height, scrollable)
└── #right    (flex 1, flex column)
    ├── #arc   (flex 1)
    └── #affix (flex 1)
```

## Full spec

See `docs/superpowers/specs/2026-06-12-affix-analysis-design.md` for the complete architecture, file list, state shape, and query signatures.
