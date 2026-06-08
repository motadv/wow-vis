# ⚔️ Presentation: WoW Data Analytics — Mythic+ Design & Adoption

**Team:** Bruna Becker, Pedro Lanzarini, Rodrigo Mota

**Course:** Game Analytics + Data Visualization (2026.1)

---

## 1. Introduction

### The World of Warcraft Endgame

- **Context:** World of Warcraft (WoW) is a MMORPG where the "endgame" begins once a player reaches the maximum level.
- **The Loop:** Players participate in repeatable, high-difficulty content to earn better gear and prestige.
- **Dungeons:** 5-player instances that serve as the primary alternative to large-scale raiding.
- **Presentation Note:** Use this slide to ground the audience in the scale of WoW's 20-year history and why its data is a goldmine for longitudinal analysis.

### What are Mythic+ Dungeons?

- **Scaling Difficulty:** Unlike static difficulty, Mythic+ uses "Keystones" to scale health and damage infinitely.
- **The Timer:** Runs must be completed within a time limit to "upgrade" the key.
- **Seasonal Rotations:** Blizzard now rotates dungeons from previous expansions (Eras) into the current pool.
- **Presentation Note:** Explain that Mythic+ isn't just about winning; it's about _pushing limits_, which creates the perfect "high-end" dataset for performance tracking.

---

## 2. Research

### Motivating Factors

- **Design Feedback Loops:** Does Blizzard's strategy of reintroducing "nostalgia" content actually result in better player performance?
- **Game Balancing:** Understanding if older dungeon designs (from "Vanilla" or "TBC") are inherently more or less popular than modern, complex designs.
- **Player Behavior:** Analyzing how familiarity with mechanics from 10 years ago translates to modern competitive play.
- **Decision Note:** We focused on "High-End" players because the Blizzard API provides leaderboard data (the top 1% of runs). This allows us to study peak performance rather than general casual play.

### Research Questions

- **Question A (Era):** Does a dungeon’s expansion era of origin predict its adoption (popularity) when it enters the Mythic+ rotation?
- **Question B (Reintroduction):** When a dungeon returns after an absence, does prior player familiarity result in higher keystone ceilings compared to its first appearance?
- **Priority:** Question B is our primary focus as it tells a clearer story about the "learning curve" over years of game updates.

---

## 3. Methodology

### Tools & Tech Stack

- **Frontend:** Vite + TypeScript for a robust, typed development environment.
- **Visualization:** **D3.js** for custom, interactive SVG world maps and detail charts.
- **Engine:** **DuckDB-Wasm** for running high-performance OLAP queries directly in the browser.
- **Data Format:** **Apache Parquet** for compressed, efficient storage of seasonal leaderboard entries.
- **Decision Note:** We chose DuckDB-Wasm to keep the dashboard "serverless." Users download the Parquet files once, and all filtering happens locally at lightning speed.

### Data Gathering & Processing

- **Source:** Blizzard Battle.net Mythic+ Leaderboard API.
- **Pipeline:** 1. **Fetch:** Node.js script collects weekly leaderboard entries per realm.

2.  **Transform:** Raw JSON is cleaned and typed.
3.  **Storage:** Data is partitioned into `season-N.parquet` files to optimize loading.

- **Manual Enrichment:** We manually mapped dungeon coordinates (MapX, MapY) to the Azeroth world map and assigned "Era" labels (e.g., _Legion_, _Shadowlands_).

### Visualizations: The Dashboard Layout

- **World Map:** An interactive SVG where node **size** represents run volume and **color** represents the expansion era.
- **Season Scrubber:** A timeline at the bottom that allows users to "watch" the meta shift as they scroll through WoW's history.
- **Detail Panels:**
- **Era View:** A horizontal bar chart comparing a dungeon's popularity against its peers.
- **Reintroduction View:** Side-by-side histograms comparing "First Appearance" performance vs. "Reintroduction" performance.

---

## 4. Progression

### Current State (`demo` branch)

- **Status:** Functional visual prototype.
- **Accomplishments:**
- D3 World Map with zoom/pan and coordinate-mapped dungeon nodes.
- Responsive state management (State.ts) for syncing the scrubber and map.
- Static mock-up of the Era and Reintroduction charts to validate the design.

- **Decision Note:** Using a `demo` branch allowed us to perfect the UI/UX before wrestling with the complexity of live API authentication and WASM integration.

### Next Steps (`main` branch)

- **Connect Real Data:** Replace `mock.ts` with the DuckDB-Wasm data layer.
- **Full Pipeline Execution:** Run the fetch script for all completed seasons to generate the final Parquet files.
- **Calibration:** Fine-tune the "Off-world" cluster for dungeons not located on the main Azeroth map (e.g., Argus or Draenor).
- **Refinement:** Implement a "Heatmap" overlay to show regional activity shifts across expansions.

---

## 5. Bibliography & Questions

### Bibliography

- Blizzard Entertainment. _Battle.net API Documentation - Mythic+ Leaderboards_.
- Bostock, M. _D3.js Data-Driven Documents_.
- DuckDB Foundation. _DuckDB-Wasm: Analytical SQL in the Browser_.
- WoWpedia. _World Map Assets & Dungeon Lore_.

### Questions?

- _Open floor for discussion on game balancing, data limitations, or the technical challenges of browser-based OLAP._

---

**Presentation Design Notes:**

- **Visual Tone:** Use a dark theme (reminiscent of the WoW UI) with "Era" colors that match the expansion logos (e.g., Fel Green for _Legion_, Ice Blue for _Wrath of the Lich King_).
- **Clarity:** Always remind the audience that this data represents the _top_ players. If a dungeon looks "unpopular," it might just be because it's too difficult for the leaderboard-level timers.

One relevant follow-up: Would you like me to generate specific D3.js code snippets for the **Reintroduction View** histogram to include in your technical appendix?
