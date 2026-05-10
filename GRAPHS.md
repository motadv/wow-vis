# Chart Reference

Both charts appear in the detail panel on the right side of the dashboard after clicking a dungeon node on the map. They share the same header (dungeon name, era badge) and a toggle to switch between the two views.

---

## Era View

**Research question answered:** Does a dungeon's expansion era of origin predict its adoption among high-end players?

### What is shown

A horizontal bar chart where each bar represents one expansion era present in the current season's dungeon pool. The length of a bar encodes the **average entry count** across all dungeons from that era — that is, how many high-end completions those dungeons collectively attracted, divided by the number of dungeons from that era in the pool.

Bars are sorted from most to least adopted, so the most popular era sits at the top.

### How to read it

- **Bar length:** higher = more completions on average for dungeons from that era this season.
- **Color:** each era has a fixed color (the same used for map nodes).
- **Opacity:** the bar for the selected dungeon's own era is rendered at full opacity; all other era bars are dimmed. This makes it immediately clear where the selected dungeon sits relative to the pack.
- **White overlay:** a semi-transparent white rectangle drawn on top of the selected dungeon's era bar represents that specific dungeon's own entry count. If the white mark extends past the midpoint of the bar, the dungeon is above its era's average; if it falls short, it is below.
- **Numeric label:** the value to the right of each bar shows the rounded average (`avg N`).

### Interpretation example

If the Wrath bar is the longest and a selected Wrath dungeon's white overlay reaches the far end of its bar, that dungeon is a top performer within an already top-performing era. If instead the overlay is short relative to the bar, the dungeon is dragging its era's average down.

---

## Reintroduction View

**Research question answered:** When a dungeon returns after one or more absent seasons, does prior player familiarity produce higher key-level ceilings compared to its first appearance?

### What is shown

A set of small multiples — one histogram panel per season in which the selected dungeon appeared. All panels share the same keystone-level x-axis domain so distributions can be compared directly across seasons.

Each histogram shows the **keystone level distribution** of high-end completions: how many completions were recorded at each key level for this dungeon in that season.

### How to read it

- **X axis:** keystone level (same range across all panels).
- **Y axis:** number of completions at each level (scaled independently per panel).
- **Color:** blue panels are labeled **First Appearance** (the first season this dungeon ever entered the Mythic+ pool); purple panels are labeled **Reintroduction** (any subsequent season).
- **Caption below each panel:** `max N · n=M` — the highest key level completed and the total entry count for that season.
- **Panel order:** seasons appear in chronological order, left to right.

### Interpretation example

If the First Appearance panel shows a distribution peaking around key 20 with a max of 25, and the Reintroduction panel shows a peak around 23 with a max of 30, the rightward shift in the distribution and higher ceiling support the hypothesis that familiarity raises performance. If the two distributions look nearly identical, familiarity produced no measurable effect.

### Special case

If a dungeon was present in every season in the dataset, a warning banner reads "Always in pool — reintroduction comparison not applicable." There is no first-versus-later contrast to draw because the dungeon never left.
