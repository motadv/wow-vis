# Slide Outline — WoW Mythic+ Data Analytics
**Partial Presentation · Game Analytics + Data Visualization · UFF Mestrado 2026.1**
**Team:** Bruna Becker · Pedro Lanzarini · Rodrigo Mota

---

## Slide 1 — Title

**Heading:** WoW Mythic+ Data Analytics
**Subheading:** How dungeon era and reintroduction history shape high-end player behavior across Mythic+ seasons

**Body:**
- Bruna Becker · Pedro Lanzarini · Rodrigo Mota
- Game Analytics + Data Visualization — UFF Mestrado 2026.1

**Design notes:** Dark background matching WoW's UI aesthetic. Accent colors drawn from the era palette (Fel green for Legion, ice blue for Wrath, amber for Dragonflight). A faint Azeroth world map as a background texture sets the visual tone immediately.

---

## Slide 2 — What is World of Warcraft?

**Heading:** 20 Years of Endgame Content

**Body:**
World of Warcraft (WoW) is one of the longest-running MMORPGs in history, launched in 2004 and continuously updated through 2026. The game is structured around an **endgame loop**: once a player reaches the maximum level, the real challenge begins. At endgame, players engage with two primary content pillars — large-scale **raids** (10–30 players) and 5-player **dungeons**.

Dungeons are tightly designed, 20–40 minute instances with scripted bosses and mechanics. Unlike raids, dungeons can be replayed indefinitely, making them the cornerstone of week-to-week engagement for millions of players. Each expansion release — roughly every two years — introduces a new set of dungeons, and older ones are retired from active rotation.

**Key numbers to anchor the audience:**
- 20+ years of content history
- 100+ unique dungeons across all expansions
- Millions of active players each season at peak

**Speaker note:** Ground the audience in scale before introducing Mythic+. Most people have heard of WoW; the point here is that its longevity makes it uniquely suited to longitudinal behavioral analysis.

---

## Slide 3 — What are Mythic+ Keystones?

**Heading:** Mythic+: Infinitely Scaling Competitive PvE

**Body:**
Introduced in the **Legion expansion (2016)**, Mythic+ Keystones transformed dungeon gameplay from a one-and-done activity into a competitive, ladder-driven system:

- **The Keystone:** A consumable item that unlocks a dungeon at a specific difficulty level, starting at +2.
- **The Timer:** Each run must be completed within a time limit. Finishing in time upgrades the key by one level; failing to beat the timer still completes the run but does not upgrade it.
- **Scaling difficulty:** At each key level, enemy health and damage increase by a fixed multiplier. There is no hard cap — keys have reached +30 and beyond in competitive play.
- **Affixes:** Starting at key level +4, "affixes" add rotating modifiers each week (e.g., enemies explode on death, players need to dodge void zones). This creates weekly variation even within the same dungeon.
- **Seasonal pool:** Each season, Blizzard selects **8 dungeons** to be in the active Mythic+ pool. Players compete to push the highest possible key level on those 8 dungeons.

The result is a system purpose-built for measuring peak performance: each leaderboard entry represents a player group that voluntarily chose the hardest version of the content they could handle, within a fixed time window.

**Speaker note:** Emphasize the timer and key-level progression — these are what make the dataset useful. Every leaderboard entry is a signal of both willingness to engage (choice) and capability (key level achieved).

---

## Slide 4 — The Dungeon Rotation Strategy

**Heading:** Blizzard's Rotation: Old Dungeons, New Seasons

**Body:**
Prior to **Shadowlands (2020)**, every Mythic+ season featured only dungeons from the current expansion. Starting with Shadowlands Season 3, Blizzard introduced the concept of mixing **current-expansion dungeons** with **returning dungeons** from previous expansions.

This "Dragonflight model" — formalized in the Dragonflight expansion (2022) — defines the current rotation structure:
- 4 dungeons from the **current expansion**, newly designed
- 4 dungeons **returning from a previous expansion**, rebalanced for current player power

This creates a historically novel situation: a dungeon designed in 2008 for Wrath of the Lich King can reappear in a 2025 season. Players who were children when it was first live may now be competing at Mythic+ level 25+.

**Why this matters for research:**
The rotation creates natural **quasi-experiments**. The same dungeon appears at two different points in history, under different player metas, different tuning, and with different levels of collective familiarity. This is not a controlled lab experiment — but it is the closest thing the game industry produces to a longitudinal repeated-measures design at population scale.

**Visual suggestion:** A horizontal timeline strip showing 3–4 seasons with their 8-dungeon pools, color-coded by era, so the audience can see the mixing pattern at a glance.

---

## Slide 5 — Three Concepts That Must Not Be Confused

**Heading:** Expansion, Era, and Season — A Precise Vocabulary

**Body:**
Before presenting any findings, it is necessary to establish exact definitions for three terms that are used throughout this work. They are related but analytically distinct, and conflating them produces category errors in interpretation.

---

**Expansion** is a major product release by Blizzard — a packaged update that raises the level cap, introduces a new world region, and ships a new set of dungeons. Expansions are the primary unit of WoW's design history. There have been eleven expansions from Vanilla (2004) to The War Within (2024). Each dungeon was designed and released within exactly one expansion. That association is permanent.

---

**Era** is not a separate concept from expansion in this project — it is the categorical label assigned to each dungeon to record its **expansion of origin**. A dungeon from Wrath of the Lich King carries `era = "wotlk"` permanently, regardless of which modern season it appears in. Era answers the question: *"What design period produced this dungeon?"* It is an attribute of the dungeon, not of time. It does not change. It functions in this analysis as a **fixed categorical predictor variable**, not as a temporal axis.

---

**Season** is a timed competitive period within the Mythic+ system — roughly 5–7 months long, with a fixed pool of 8 dungeons, its own leaderboard, and its own affix rotation. Seasons are numbered sequentially and treated as a globally ordered sequence for analysis purposes. A dungeon that is absent from a season's pool produces no leaderboard data in that period; it effectively does not exist competitively. **Season is the temporal axis of this entire analysis.**

---

| Term | What it is | Role in this project |
|---|---|---|
| **Expansion** | A major Blizzard product release | Defines which dungeons exist and when they were designed |
| **Era** | Shorthand for expansion of origin | Fixed categorical attribute — independent variable in Question A |
| **Season** | A timed Mythic+ competitive period | The temporal axis — unit of all observations |

---

**The apparent paradox — and why it is not one:**

Mythic+ Keystones were introduced in **Legion (2016)**. Dungeons from Vanilla, TBC, WotLK, Cataclysm, MoP, and WoD were designed years or decades before the system existed. How can a timeline analysis include them?

The answer is that the **timeline of analysis is the Mythic+ season sequence (2016–present)**, not WoW's publication history. WoW history provides only the `era` label — a descriptor of design provenance. The actual observations — leaderboard entries, keystone levels, completion counts — exist only from the moment a dungeon entered a Mythic+ pool. A Wrath dungeon that first appeared in a Shadowlands season has data starting in that season and none before it. Its `era = "wotlk"` label says where it came from; the season record says what players did with it.

The 2016 cutoff is therefore a **scope constraint**, not an analytical gap. It defines the boundary of observable competitive behavior, and every dungeon in the dataset — regardless of era — is only analyzed within that boundary.

---

## Slide 6 — Research Questions

**Heading:** What We're Asking

**Body:**
Our analysis is organized around one overarching question:

> *"How do a dungeon's expansion era of origin and its reintroduction history shape high-end player adoption and key-level progression across Mythic+ seasons?"*

This splits into two testable sub-questions:

---

**Question A — Era**
> *Does a dungeon's expansion era of origin predict its adoption among high-end players when it enters the Mythic+ pool?*

**Operationalization:** Compare average leaderboard entry counts across era cohorts. Do Legion dungeons consistently attract more entries than Vanilla dungeons in their debut seasons? Does design era correlate with volume independently of recency?

---

**Question B — Reintroduction** *(primary focus)*
> *When a dungeon is reintroduced after being absent for one or more seasons, does player familiarity produce higher key-level ceilings compared to its first appearance?*

**Operationalization:** For each dungeon with ≥2 appearances (first + at least one return), compare the key level distribution in the first season vs. each subsequent reintroduction season. A rightward shift in the distribution on reintroduction suggests that accumulated player knowledge — from guides, optimized routes, practiced group compositions — translates into higher peak performance.

---

**Why Question B is preferred:**
Question A describes a static property of a dungeon. Question B captures a dynamic process — the feedback loop between Blizzard's design decisions and collective player adaptation over years. It tells a clearer causal story and is more original as a research contribution.

---

## Slide 7 — Data Source

**Heading:** Blizzard Battle.net Mythic+ Leaderboard API

**Body:**
All data comes from the **official Blizzard Battle.net API**, specifically the Mythic+ leaderboard endpoints. Data is pre-fetched offline using a Node.js script and stored as compressed Parquet files — no live API calls happen during the visualization.

**What the API provides:**
For each **connected realm** (a group of merged servers), the API exposes the top-ranked dungeon completions for a given season. Each leaderboard entry contains:
- The **dungeon** (`map_challenge_mode_id`)
- The **keystone level** achieved
- The **completion time** in milliseconds
- The **period** (weekly window)
- The **roster** (player IDs, specializations)

**What we extract per dungeon per season:**
- Number of leaderboard entries → proxy for high-end activity volume
- Key level distribution (min / median / max / histogram)
- Whether this season is the dungeon's first Mythic+ appearance or a reintroduction

**Manual enrichment added by the team:**
- `era` — expansion label (e.g., `"legion"`, `"wotlk"`)
- `mapX` / `mapY` — pixel coordinates on the Azeroth world map
- `offWorld` — flag for dungeons in instanced zones with no map anchor (e.g., Argus, Draenor Alternate)

---

## Slide 8 — Data Limitations

**Heading:** What the Data Cannot Tell Us

**Body:**
This limitation is not a footnote — it fundamentally shapes how we interpret every finding, and it must be stated clearly in both the paper and the visualization itself.

**The core constraint:**
The Blizzard leaderboard API is a **ranking tool**, not a census. It returns the top completions per connected realm per weekly period. There is no public endpoint that exposes total run counts across the entire playerbase.

**Consequences:**
- A dungeon with high leaderboard entries is popular among **key pushers** — players who actively try to maximize their key level. It may or may not be popular among casual players.
- A dungeon with low leaderboard entries could be genuinely unpopular, or it could be so mechanically demanding that fewer groups attempt it at high levels — two very different stories.
- Volume comparisons across seasons are influenced by playerbase size changes (expansions spike subscriptions), not only by dungeon appeal.

**What we can defensibly say:**
> "Among players who appear on realm leaderboards, dungeon X attracted N% more entries in its reintroduction season than in its debut season."

**What we cannot say:**
> "Dungeon X is more popular."

**Speaker note:** Be direct about this when presenting. The limitation makes the finding more specific, not weaker — it's a precise claim about a specific population.

---

## Slide 9 — Tech Stack Overview

**Heading:** Technology Choices and Why

**Body:**
The dashboard is fully static — no backend server, no live API dependency. Every component runs in the browser after an initial asset download.

| Layer | Technology | Why |
|---|---|---|
| Build & dev server | Vite + TypeScript | Fast HMR, strict typing, no runtime overhead |
| Map & charts | D3.js (SVG) | Full control over encoding, animation, and interaction |
| In-browser OLAP | DuckDB-Wasm | Run aggregation SQL on Parquet files locally — no server |
| Data format | Apache Parquet | Columnar compression; efficient for analytical queries |
| Dungeon manifest | JSON | Static metadata served alongside Parquet files |
| Styling | Plain CSS | No framework dependency; straightforward dark theme |
| Data collection | Node.js + tsx | Run TypeScript scripts offline with minimal setup |

**Key design decision — DuckDB-Wasm:**
The Parquet files are downloaded once and queried entirely in the browser via WebAssembly. This means the dashboard works offline after first load, queries complete in milliseconds even on large datasets, and no infrastructure needs to be maintained. The tradeoff is a COOP/COEP header requirement (configured in `vite.config.ts`) to enable the SharedArrayBuffer that DuckDB-Wasm relies on.

---

## Slide 10 — Data Pipeline

**Heading:** From API to Browser: The Data Flow

**Body:**
The pipeline has two completely separate phases that share no runtime:

### Phase 1 — Offline pre-fetch (run once per season update)

```
Blizzard API (OAuth2 Client Credentials)
  └─ Node.js script  (npm run fetch)
       ├─ Fetch season index → list of all completed seasons
       ├─ For each season:
       │    ├─ Fetch dungeon pool for that season
       │    └─ Fetch leaderboard entries per dungeon × realm × period
       ├─ Transform raw JSON → typed rows
       ├─ Write season-N.parquet  (one file per completed season)
       └─ Write dungeons.json     (dungeon manifest)
```

After the script runs, the team manually edits `dungeons.json` to fill in `era`, `mapX`, `mapY`, and `offWorld` for each dungeon — information that does not exist in the API.

### Phase 2 — In-browser runtime

```
Browser loads index.html
  └─ Fetch dungeons.json (manifest: names, eras, map coords, season list)
  └─ Init DuckDB-Wasm
  └─ On season select: fetch season-N.parquet → load into DuckDB table
  └─ Run aggregation queries → volume rows, key distributions
  └─ D3.js renders map nodes, scrubber, detail panel
```

All user interactions (season change, dungeon click, era filter) trigger SQL queries against the in-memory DuckDB instance. No page reloads, no network round-trips after initial load.

---

## Slide 11 — Dashboard Layout

**Heading:** Four-Zone Dashboard

**Body:**
The dashboard is organized into four persistent zones:

```
┌──────────────────────────────────────────────────────┐
│  Filter bar  [Era toggles]  [Era / Reintroduction]   │  ← top bar
├──────────────────────────────────────────────────────┤
│                                    ┌───────────────┐ │
│                                    │               │ │
│         World Map (D3 SVG)         │ Detail Panel  │ │  ← center
│         zoomable / pannable        │ (slides in)   │ │
│                                    └───────────────┘ │
├──────────────────────────────────────────────────────┤
│  Season scrubber  [S1] [S2] [S3] [S4] [S5] ...      │  ← bottom bar
└──────────────────────────────────────────────────────┘
```

- **Filter bar** (top): Era checkboxes let users isolate specific expansion cohorts. The Era/Reintroduction toggle switches the entire dashboard's color encoding and default chart view.
- **World map** (center-left): Primary storytelling surface — animated, zoomable, geographically grounded.
- **Detail panel** (center-right): Slides in over the map (no layout shift) when a dungeon is clicked. Shows the deep analytics for the selected dungeon.
- **Season scrubber** (bottom): Pill buttons for each completed season. Clicking one re-queries the database and animates all map node sizes to reflect that season's volume data.

**Visual suggestion:** Annotated screenshot of the dashboard in demo state, with numbered callout labels for each zone.

---

## Slide 12 — World Map: Visual Encoding

**Heading:** The Map as the Primary Analytical Surface

**Body:**
The world map is not decorative — it is the core interaction surface. Every design decision encodes a dimension of the data:

**Node encoding:**
- **Size (radius):** Proportional to the square root of leaderboard entry count in the selected season. Sqrt scaling prevents very popular dungeons from overwhelming smaller ones visually. A dungeon absent from the current season's pool shrinks to near-zero rather than disappearing abruptly.
- **Color:** In **Era mode**, each node is filled with the color of its expansion era (e.g., ice blue for Wrath, Fel green for Legion, amber for Dragonflight). In **Reintroduction mode**, nodes are tinted blue for first-appearance dungeons and purple for reintroduced dungeons.
- **Position:** Pinned to the dungeon's geographic location in the game world. Dungeons in Northrend cluster in the north; Outland dungeons cluster to the east. This gives the map geographic meaning — as you step through seasons, you can see which regions of Azeroth were "active" in each era.
- **Off-world cluster:** Dungeons in instanced zones with no Azeroth anchor (e.g., Argus, Alternate Draenor) are grouped at a fixed position at the map edge, labeled "Off-world."

**Interaction:**
- Zoom and pan (D3 zoom, scale range 0.4×–5×) let users explore the map at any level of detail.
- Hover shows a tooltip with the dungeon name, era, and max key level for the selected season.
- Click opens the detail panel.

---

## Slide 13 — Season Scrubber: Longitudinal Storytelling

**Heading:** Scrubbing Through History

**Body:**
The season scrubber at the bottom of the dashboard is the primary mechanism for longitudinal exploration. Each completed Mythic+ season is represented as a pill button in chronological order.

**What happens when you click a season:**
1. A DuckDB query fetches aggregated volume data for that season from the corresponding Parquet file.
2. All map node radii animate (300ms ease transition) to reflect the new volume values.
3. Dungeons that were not in the pool that season shrink toward zero.
4. Dungeons newly entering the pool grow from zero.
5. The active season pill gets a highlight state.

**What you can observe:**
- How the "center of gravity" of dungeon activity shifts across regions of the map as eras come and go.
- Which dungeons consistently attract large nodes across multiple seasons (perennially popular content).
- Which dungeons spike on first appearance and then shrink on reintroduction — or the reverse.

This animation is the most direct visual answer to both research questions: it makes the era composition and the reintroduction pattern legible at a glance before any user clicks into the detail panel.

---

## Slide 14 — Detail Panel: Era View (Question A)

**Heading:** Era View — Does Origin Predict Adoption?

**Body:**
Clicking any dungeon node opens the detail panel and shows the **Era View** by default.

**Chart description:**
A horizontal bar chart with one bar per expansion era currently represented in the dungeon pool. Bars are sorted descending by average leaderboard entry count across dungeons of that era. The selected dungeon's era bar is highlighted with a brighter overlay.

**Axes:**
- X-axis: average leaderboard entry count, formatted with SI notation (1k, 2k, etc.). Labeled "Avg completions."
- Y-axis: era name labels (Vanilla, TBC, WotLK, Cataclysm, MoP, WoD, Legion, BfA, Shadowlands, Dragonflight, TWW).
- Vertical gridlines at each tick provide a reading guide on the dark background.

**What to read from this chart:**
The chart answers: "Among high-end players in this season, did dungeons from this era attract more or fewer runs than dungeons from other eras?" If the selected dungeon's era bar is far to the right, players gravitate toward that era's design style. If it's short, this era's dungeons are less adopted relative to peers — which could mean lower appeal or higher difficulty ceiling.

**Limitation reminder:** The bar shows leaderboard entries, not total runs. A short bar could mean a less popular dungeon or one where fewer groups reach the leaderboard threshold.

---

## Slide 15 — Detail Panel: Reintroduction View (Question B)

**Heading:** Reintroduction View — Does Familiarity Raise the Ceiling?

**Body:**
Switching to the **Reintroduction tab** in the detail panel shows the core analysis for Question B.

**Chart description:**
A vertical stack of small histogram panels — one per season in which the selected dungeon appeared in the Mythic+ pool. Each histogram shows the distribution of keystone levels achieved by leaderboard entries in that season.

**Visual encoding:**
- **First appearance:** Blue bars (`#60A5FA`). The season when this dungeon debuted in Mythic+.
- **Reintroduction:** Purple bars (`#A78BFA`). Every subsequent season this dungeon returned.
- **Shared x-axis domain:** All panels use the same key level range, so distributions are directly comparable left-to-right.
- **Independent y-axis per panel:** Each panel scales to its own entry count, so the shape of the distribution is readable regardless of total volume differences between seasons.
- **Caption per panel:** `max {N} · n={M}` — the highest key level completed and total entry count.

**Special cases:**
- Dungeons that appear in every single season are flagged with an **amber warning banner** ("Always in pool — reintroduction comparison not applicable"). These dungeons have no meaningful "absence" period, so the familiarity hypothesis does not apply.
- Dungeons with very few entries show an empty-state message noting sparse data.

**What to read from this chart:**
If the purple (reintroduction) histogram is shifted rightward compared to the blue (first appearance) histogram — higher max keys, distribution mass concentrated at higher values — that supports the hypothesis that player familiarity raises the performance ceiling. If the distributions look similar or the reintroduction is shifted left, the evidence goes the other way.

---

## Slide 16 — Implementation: Demo Branch

**Heading:** Current State — Fully Interactive Visual Prototype

**Body:**
The `demo` branch is a complete, screenshot-ready version of the dashboard built on **hardcoded mock data**. It demonstrates the full visual and interaction design without requiring a live Blizzard API connection or DuckDB-Wasm.

**What is implemented:**
- `src/state.ts` — lightweight pub/sub state machine managing `selectedSeason`, `selectedDungeon`, and `viewMode`. All chart modules subscribe to this; no global variables.
- `src/mock.ts` — 12 hardcoded dungeons spanning 5 eras (Vanilla, WotLK, Legion, Dragonflight, TWW), 2 mock seasons, plausible volume and key distribution data.
- `src/charts/map.ts` — D3 SVG world map with zoom/pan, era-colored dungeon nodes, hover tooltip, off-world cluster, node size animation on season change.
- `src/charts/scrubber.ts` — season pill buttons that update state and trigger map animation on click.
- `src/charts/detail/era.ts` — horizontal bar chart with gridlines, x-axis, and axis label.
- `src/charts/detail/reintroduction.ts` — vertical stack of key level histograms with shared x-domain, labeled first appearance vs. reintroduction, per-panel captions.
- `src/charts/detail/index.ts` — detail panel shell that slides in over the map (CSS transform, no layout shift), with dungeon header, era badge, view toggle, and close button.

**Design approach:** Real app, mock data layer. The chart modules are production implementations — only the data source differs from the final app. When the real pipeline is connected, `mock.ts` is deleted and the chart modules are unchanged.

---

## Slide 17 — Implementation: Next Steps (Main Branch)

**Heading:** What Remains — Connecting Real Data

**Body:**
The visual layer is complete. What remains is wiring the real data pipeline to the existing chart modules.

**Step 1 — Offline data collection:**
Run `npm run fetch` against the Blizzard API to generate `season-N.parquet` files and `dungeons.json` for all completed seasons. The OAuth authentication and API call logic is already implemented; this step requires valid Battle.net credentials and a one-time execution.

**Step 2 — Manual manifest enrichment:**
For every dungeon in the generated `dungeons.json`, fill in:
- `era` — which expansion this dungeon originates from
- `mapX`, `mapY` — pixel coordinates on the Azeroth world map PNG
- `offWorld` — whether the dungeon is in an instanced zone with no map anchor

**Step 3 — DuckDB-Wasm integration:**
Replace `mock.ts` imports in `src/charts/init.ts` with the real `src/db/init.ts` and `src/db/queries.ts` modules. The query functions (`getVolumeRows`, `getKeyDistribution`) already have typed signatures that match what the chart modules expect.

**Step 4 — Filter bar:**
Implement `src/charts/filters.ts` — era multiselect checkboxes and the Era/Reintroduction mode toggle. These update `state.filterEras` and `state.viewMode`, which the map and detail panel already subscribe to.

**Step 5 (Stretch) — Regional heatmap:**
Instead of discrete circle nodes, diffuse a heat glow from each dungeon's map position, weighted by volume. As the scrubber plays, the heat shifts across regions of Azeroth — Northrend glows when WotLK dungeons dominate, Outland when TBC dungeons return. This gives Question A a spatial argument that era bar charts cannot convey.

---

## Slide 18 — Bibliography

**Heading:** References

**Body:**
- Blizzard Entertainment. *Battle.net Developer API Documentation — Mythic Keystone Leaderboard Endpoints*. https://develop.battle.net/
- Bostock, M., Ogievetsky, V., Heer, J. (2011). *D³: Data-Driven Documents.* IEEE Transactions on Visualization and Computer Graphics.
- DuckDB Foundation. *DuckDB-Wasm: Analytical SQL in the Browser via WebAssembly*. https://duckdb.org/docs/api/wasm/overview
- WoWpedia. *World of Warcraft World Map Assets & Dungeon Lore*. https://wowpedia.fandom.com/

---

*Questions & discussion*
