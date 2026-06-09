# Visualization Design Decisions

This document records every non-obvious decision made during the visualization layer, including abandoned directions, analytical reframings, and design choices that are not derivable from the code alone.

---

## 1. Abandoned metric: entry count as dungeon popularity

### 1.1 The leaderboard cap problem

The original era-view hypothesis was: dungeons from older expansions would have fewer leaderboard entries than native-season dungeons, reflecting lower player adoption.

After collecting data, every active dungeon in every season hit the same entry ceiling — approximately 57,000–72,000 rows. Querying across all seasons confirmed:

| Season range | Approx. rows per dungeon |
| ------------ | ------------------------ |
| 6–11 (SL/DF) | ~57,500                  |
| 12–15 (TWW)  | ~60,000–72,000           |

**Root cause:** Blizzard's leaderboard stores the top 500 runs per dungeon per realm per week. With 5 sampled realms and ~24 weekly periods per season, the ceiling is 5 × 24 × 500 = 60,000. Every active dungeon reaches it. Entry count is a measure of data availability, not player preference.

**Consequence:** Volume-based charts (era bar chart, cross-season scrubber) were removed entirely. The `entry_count`, `min_key`, and `max_key` columns were dropped from the query layer.

---

## 2. Reframed metric: keystone level as competitive pushability

### 2.1 What keystone level measures

Because the leaderboard only retains the top 500 runs per dungeon per realm per week, the `keystone_level` distribution in the dataset represents the *competitive ceiling* — how high the best players pushed each dungeon. A higher median key means players were more willing and able to push that dungeon at high difficulty.

This reframes the research questions from adoption (how many runs) to **pushability** (how hard runs were pushed):

1. **Within a season:** how does a dungeon's competitive ceiling evolve week by week?
2. **Across seasons:** for dungeons that reappear in multiple seasons, does their relative pushability rank stay stable or shift?

### 2.2 Cross-season normalization

Raw keystone levels are not comparable across expansion eras. Blizzard re-scales M+ difficulty at each expansion launch:

| Era           | Typical competitive median key |
| ------------- | ------------------------------ |
| Shadowlands   | 24–26                          |
| Dragonflight  | 12–16                          |
| The War Within | 12–16                         |

Using raw keys in a cross-season heatmap would encode expansion era, not dungeon performance. The fix is **within-season rank**: for each season, rank all active dungeons 1–N by median key (rank 1 = highest pushed). This strips out era-wide scaling and encodes only whether a dungeon was pushed harder or softer than its contemporaries in a given season.

The normalization for heatmap color is: `1 - (rank - 1) / (total - 1)`, yielding 1.0 for the top dungeon and 0.0 for the bottom, applied to a sequential blue scale (darker = higher pushed).

The arc (timeline) chart uses raw keys on a **fixed Y axis** — the global min/max median key across all seasons and dungeons, computed at startup. This allows direct cross-dungeon comparison: SL dungeons cluster in the 20–34 range, DF/TWW dungeons in the 10–20 range, making expansion-era differences visible without needing to read the heatmap.

---

## 3. Layout decisions

### 3.1 Heatmap as primary element

The heatmap (dungeons × seasons matrix) is the analytical anchor of the visualization. The world map was demoted from a primary view to a secondary navigation aid. Final layout:

- **Left column:** world map (geographic dungeon selector, top) + arc timeline (bottom, fixed 220 px height)
- **Right column:** heatmap, full viewport height, vertically scrollable

The heatmap panel uses `flex-shrink: 0` and derives its width from the SVG content (≈ 330 px for 10 seasons at 18 px cells + 160 px dungeon label area). The map takes the remaining horizontal space via `flex: 1`.

### 3.2 Cell dimensions

Heatmap cells are 18 × 18 px squares. This was chosen to:
- Fit 49 dungeons in the vertical without the matrix becoming unreadably tall
- Keep column widths narrow enough that the matrix occupies a sidebar-like panel
- Allow the season headers ("S1"–"S10") to render as plain horizontal text without rotation

### 3.3 Season labeling

Seasons are labeled S1–S10 (sequential index of seasons with data, not their Blizzard season ID). Blizzard season IDs 1–5 have no leaderboard data; the first season with data (ID 6, Shadowlands Season 2) is labeled S1. Full season names are available in the hover tooltip.

---

## 4. Arc (timeline) chart

### 4.1 Design

One line per season the dungeon appeared in, colored by a categorical palette (Tableau10) keyed to season index. The season emphasized in the legend (selected via heatmap cell click or legend click) is drawn at full opacity and 2.5 px stroke; all others are dimmed to 0.3 opacity and 1.5 px stroke.

### 4.2 Stale-render guard

The arc subscriber is async (it loads season parquets and queries DuckDB on dungeon selection). A stale-render guard captures `selectedDungeon` before any `await` and discards the result if the state has changed by the time the query resolves:

```ts
const dungeonAtStart = state.selectedDungeon;
// ... await loadSeason + getWeeklyArc ...
if (getState().selectedDungeon !== dungeonAtStart) return;
```

This prevents a slow season load from rendering a dungeon that the user has already navigated away from.

### 4.3 Period index vs. raw period ID

Blizzard period IDs are absolute week numbers (e.g., 977–1000 for a season). The arc X axis uses a 1-based index derived by sorting periods ascending and assigning 1, 2, 3, … This makes the X axis read "Week 1, Week 2, …" regardless of which absolute period IDs a season used, and allows visual comparison of season arcs that share the same number of weeks.
