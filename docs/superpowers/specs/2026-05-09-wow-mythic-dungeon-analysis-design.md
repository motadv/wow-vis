# WoW Mythic+ Dungeon Analysis — Design Spec

**Date:** 2026-05-09
**Course:** Game Analytics + Data Visualization — UFF Mestrado 2026.1
**Team:** Bruna Becker, Pedro Lanzarini, Rodrigo Mota

---

## Research Question

> **"How do a dungeon's expansion era of origin and its reintroduction history shape high-end player adoption and key-level progression across Mythic+ seasons?"**

Two interlocking sub-questions drive the analysis:

- **Question A (Era):** Does the expansion era a dungeon originates from predict its adoption among high-end players when it enters the Mythic+ pool?
- **Question B (Reintroduction):** When a dungeon is reintroduced to the pool after being absent for one or more seasons, does familiarity produce higher key-level ceilings compared to its first appearance?

**Priority note:** If scope forces choosing one, Question B (Reintroduction) is preferred — it is more novel, directly testable, and tells a cleaner design feedback loop story.

---

## Data Scope & Limitations

**Seasons covered:** All completed Mythic+ seasons up to and excluding the current in-progress season.

**API source:** Blizzard Battle.net Mythic+ Leaderboard API. Data is pre-fetched offline and stored as Parquet files in `public/data/`. No live API calls at runtime.

**Critical limitation:** The leaderboard API returns only top completions per connected realm per week — it is a ranking tool, not a census. Total run counts across all players are not available via any public Blizzard endpoint. All findings therefore reflect **high-end player behavior** (key pushers), not the general playerbase. The paper and visualization must make this scope explicit.

**What we can measure per dungeon per season:**
- Number of leaderboard entries (proxy for high-end activity volume)
- Key level distribution (min / median / max)
- Whether the season is the dungeon's first M+ appearance or a reintroduction
- Expansion era label

---

## Visualization Layout

### World Map (primary panel)

A zoomable SVG of the Azeroth world map using a static high-resolution PNG as the background `<image>` layer, with D3 SVG elements on top.

Each dungeon is rendered as a **circle node** pinned to its in-world geographic location (coordinates mapped manually to pixel positions on the map image).

Node encoding:
- **Size** → leaderboard entry count (activity volume) in the selected season
- **Color** → expansion era palette (one hue per era) in Era mode; two-tone first-appearance vs. reintroduction in Reintroduction mode
- **Hover** → tooltip: dungeon name, era, seasons in pool, key level stats
- **Click** → opens the detail panel

Dungeons in instanced zones with no clear world map anchor (e.g., Argus) are clustered in an "Off-world" area at the map edge with a visual label.

When a dungeon exits the pool in a given season, its node fades out rather than disappearing abruptly.

### Season Scrubber (bottom bar)

A horizontal timeline of all completed seasons. Stepping or dragging through it animates the map: nodes appear/disappear/resize as dungeons enter and leave the pool each season. This is the primary longitudinal storytelling mechanism.

### Detail Panel (right sidebar)

Triggered on dungeon click. Two tabs:

- **Era view (A):** Bar chart comparing this dungeon's activity volume against the season average, broken down by era cohort for context.
- **Reintroduction view (B):** Small multiples of key level distribution across each season the dungeon appeared — first appearance and subsequent reintroductions shown side by side.

Dungeons that appear in every season are flagged as "Always in pool" to prevent misreading of the reintroduction comparison.

### Global Filters (top bar)

- Era multiselect
- Season range slider
- Key level threshold

Filtering dims non-matching nodes without removing them from the map.

### View Mode Toggle

A toggle in the top bar switches between **Era mode** (Question A) and **Reintroduction mode** (Question B), changing node color encoding and the default detail panel tab.

---

## Data Pipeline

### Offline Pre-fetch (run once per season update)

A Node.js script in `scripts/fetch/` authenticates with the Blizzard API using client credentials OAuth flow, then fetches:

1. Mythic+ season index → list of all seasons
2. Per season: dungeon pool + list of weekly periods
3. Per dungeon per period: leaderboard entries (keystone level, completion time)

Output:
- `public/data/season-{id}.parquet` — one file per season with all leaderboard entries
- `public/data/dungeons.json` — manifest mapping dungeon IDs to name, expansion era, map pixel coordinates, and list of seasons appeared

### In-Browser Runtime

```
dungeons.json      → static metadata, map pin positions, season appearance list
Parquet files      → loaded on demand by DuckDB-Wasm via fetch (per season)
DuckDB queries     → aggregated volume + key level distributions
D3.js              → map nodes, scrubber animation, detail panel charts
```

DuckDB queries execute when the user changes season or clicks a dungeon. The two state variables driving all re-renders are: **selected season** and **selected dungeon**. No state management library needed.

---

## Edge Cases

| Case | Handling |
|---|---|
| Dungeon with no world map location (Argus, etc.) | Off-world cluster at map edge |
| Dungeon in pool every season | "Always in pool" flag; excluded from reintroduction comparison |
| Season with very few leaderboard entries | Node still rendered; tooltip notes sparse data |
| Current incomplete season | Excluded from scrubber entirely |

---

## Stretch Goal — Regional Heatmap

Instead of isolated circle nodes, diffuse a heat glow outward from each dungeon's map position, weighted by that season's activity volume. This creates a **per-region activity heatmap** that makes the geographic distribution of Blizzard's design investment legible at a glance — Northrend glows when WotLK dungeons dominate a season, Outland when TBC dungeons are favored. As the user scrubs through seasons, the heat shifts across the map, giving Question A a spatial argument beyond era labels alone.

Implementation: D3 radial gradients or a canvas-based kernel density layer behind the SVG node layer.

This is optional and should be implemented only after the core A+B system is stable.

---

## Tech Stack Alignment

| Layer | Technology |
|---|---|
| Build & dev server | Vite + TypeScript |
| Map & charts | D3.js (SVG) |
| In-browser OLAP | DuckDB-Wasm |
| Data format | Parquet (seasons) + JSON (dungeon manifest) |
| Styling | Tailwind CSS |
| Data collection | Node.js pre-fetch script (Blizzard OAuth) |
