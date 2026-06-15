# Affix Analysis Dashboard Redesign

**Date:** 2026-06-15

**Context:** This spec replaces the previous three-lens affix panel design with a unified dungeon browser + dynamic affix analysis system. The redesign prioritizes visual clarity, intuitive exploration ("start broad, drill down"), and preparation for future cross-panel interactions. All visualizations use creative encodings suitable for a data visualization course.

---

## Overview

The affix analysis dashboard is restructured into three integrated views:

1. **Dungeon Browser** — unified selection tool showing all dungeons by expansion/season
2. **Arc Chart** — progression of selected dungeon (single selection)
3. **Affix Panel** — dynamic affix impact analysis (multi-selection)

**Selection model:** Click a dungeon → single selection → arc updates. Select multiple dungeons → multi-selection → affix panel drill-down shows aggregate and individual analyses.

**Layout:** Scrollable page with full-width stacked views. Each view gets generous vertical space for detailed exploration.

---

## 1. Dungeon Browser

### Purpose

Replace the current "heatmap" view with a unified dungeon selection tool. Users browse all dungeons organized by expansion/season, see difficulty rankings and primary affix (Fortified/Tyrannical) splits, and select one or many dungeons for downstream analysis.

### Data & Display

**Organization:** Dungeons grouped by season (Season 9, Season 8, etc.), sorted by difficulty within each season (hardest first).

**Per-dungeon display (per row):**
- Dungeon name
- Difficulty score (median keystone level for that dungeon in that season)
- **Fortified vs Tyrannical split** — stacked/side-by-side bar showing relative difficulty of each affix
  - Both affixes equally prominent
  - Bar length proportional to difficulty
- Era/dungeon category visual indicator (color, icon, or badge)
- Selection state indicator (checkbox, outline, highlight, or toggle state)

**Visual format:**
- **Swimlane layout** (adapting current heatmap structure)
  - Season headers (Season 9, Season 8, etc.)
  - Under each season: dungeon rows sorted by difficulty (highest to lowest)
  - Each row contains: dungeon name | F/T split bar | difficulty score | selection indicator
  - Scrollable vertically through seasons
  - Similar to current heatmap but supporting multi-selection

### Interaction

- **Click to toggle selection** — click a dungeon row to toggle its selection state (selected ↔ unselected)
  - Visual feedback: selected rows highlighted, checkbox/outline state updates
  - Can select multiple dungeons across different seasons
- **Smart routing:**
  - If 1 dungeon selected → arc chart updates to show that dungeon's progression
  - If 2+ dungeons selected → affix panel shows drill-down view with aggregate + individual radials
  - Deselecting all dungeons clears both arc and affix views (return to empty state)
- **Controls:**
  - "Reset" or "Clear all" button — deselect all dungeons at once
  - (Optional) Season filter to collapse/expand seasons

### Data Source

- Aggregate median keystone level per dungeon (from leaderboard Parquet files)
- Fortified/Tyrannical split (count or median key level per affix, calculated in browser)
- Expansion/season metadata (from dungeons.json)

---

## 2. Arc Chart

**No changes.** Remains single-dungeon progression visualization. Updated when a single dungeon is selected in the browser.

---

## 3. Affix Panel — Drill-Down View

### Purpose

Provide dynamic, visual analysis of secondary affix impact on selected dungeons. Answer key questions:
- "Which secondary affixes make dungeons significantly harder/easier?"
- "Are certain dungeon + affix combinations problematic?"
- "How do affixes impact the selected dungeon(s)?"

### Structure

The affix panel displays **different content based on selection count:**

#### **Case 1: Single Dungeon Selected**

Show that dungeon's affix impact in detail.

**Layout (top to bottom):**
1. **Title/breadcrumb** — dungeon name, back button to browser
2. **Season/expansion filters** (optional)
3. **Primary Affix Trend** (stream graph)
   - X-axis: weeks/periods across the season
   - Visual: Fortified vs Tyrannical as flowing streams
   - Width/shape represents relative influence or frequency
   - Hover tooltip: exact values, period/week number
4. **Secondary Affix Impact** (radial chart, large and readable)
   - Radial arms for each secondary affix
   - Arm length = impact magnitude (difficulty delta vs baseline)
   - Arm color = affix identity (consistent across all views)
   - Inward arms (negative space) = easier affixes
   - Center circle = baseline (no affix)
   - Hover tooltip: exact impact delta, affix name
   - All text labels appear on hover, not by default

#### **Case 2: Multiple Dungeons Selected (2–3)**

Show aggregate analysis first, then individual comparisons.

**Layout (top to bottom):**
1. **Title/breadcrumb** — list selected dungeons, back button
2. **Season/expansion filters** (optional)
3. **Primary Affix Trend** (stream graph, aggregate)
   - Combined Fortified/Tyrannical balance across all selected dungeons
   - Visual: flowing streams showing balance shift over weeks
   - Hover tooltip: exact values
4. **Secondary Affix Impact — Aggregate** (radial chart, large)
   - One radial showing combined/averaged secondary affix impact across all selected dungeons
   - Label: "Aggregate (all selected dungeons)" or "Combined Impact"
   - Same encoding as single-dungeon radial
   - Hover tooltip: exact impact deltas
5. **Secondary Affix Impact — Individual** (radial grid, 2–3 per row)
   - One radial per dungeon
   - Each radial labeled with dungeon name
   - Smaller than aggregate but still readable
   - Same encoding as aggregate
6. **Expand link** (if >3 dungeons selected)
   - "View all X dungeons" link
   - Clicking expands to full grid view (all selected dungeons visible)
   - Grid scales to 2–4 radials per row depending on screen size

#### **Case 3: Many Dungeons Selected (>3, initial view)**

Show aggregate + top 3 most different dungeons + expand link.

**Layout:**
- Same as Case 2, but the individual radials grid shows only the 3 most interesting/different dungeons
- "View all X dungeons" link to expand to full grid

### Visualizations

#### **Stream Graph (Primary Affixes)**

**Purpose:** Show Fortified vs Tyrannical balance over time.

**Encoding:**
- X-axis: weeks/periods (time)
- Y-axis: relative influence (stacked or normalized)
- Two flowing "streams" (Fortified and Tyrannical)
- Width at each point = relative influence/frequency
- Color: Fortified = blue (#3b82f6), Tyrannical = orange (#f97316)
- Hover tooltip: period number, week, exact median key level for each affix

**Interactivity:**
- Hover shows exact values
- Click on a period (optional, future): could filter affix radials to that week only

#### **Radial Chart (Secondary Affixes)**

**Purpose:** Show which secondary affixes make a dungeon harder or easier.

**Encoding:**
- Center: baseline (no affix, center circle or origin point)
- Radial arms: one per secondary affix
- Arm length: magnitude of impact (difficulty delta from baseline)
  - Longer arm = bigger impact
  - Scale: proportional or absolute (TBD during implementation)
- Arm direction: radiating outward from center
- Arm color: consistent across all radials, unique per affix
  - Red family = harder affixes
  - Green family = easier affixes
  - Yellow/purple/other for neutral affixes
- Inward arms (negative space / inverted): easier affixes (optional visual encoding)
  - If arm represents "difficulty delta," negative values could point inward
  - Or: all arms outward, but color indicates direction
- Labels: no default labels; appear on hover only
- Hover tooltip: affix name, exact impact delta (e.g., "+1.8" or "-0.4")

**Size:**
- Single-dungeon radial: large enough to see all affix arms clearly, read on hover (~200–300px diameter)
- Aggregate radial (multi-select): same size, prominently positioned
- Individual radials (grid): medium size for comparison (~120–150px diameter)

### Interaction Model

**Filters & Controls (top of panel):**
- **Season dropdown** — select which season to analyze (defaults to current/latest)
- **Expansion filter** (optional) — narrow to dungeons from specific expansion
- **Fortified/Tyrannical toggle** (optional) — show impact for one affix type only
- **Back/clear button** — return to dungeon browser, deselect all

**Radial & Stream Hover:**
- Hover on any visual element (arm, stream, chart area) → tooltip appears
- Tooltip shows: exact numeric value, affix/period name, context
- No click interactions on radials yet (structure for future features)

**Multi-select expansion:**
- "View all X dungeons" link → expands to full grid view
- Grid shows all selected dungeons' radials in a responsive grid
- Scrollable if many dungeons
- Link to collapse back to top 3 + aggregate

### Empty States

**No dungeons selected:**
- Message: "Select a dungeon in the browser to begin analyzing affix impact."

**Single dungeon, no secondary affix data:**
- Message: "No secondary affix data for this season/dungeon combination."

**Single dungeon, no primary affix variation:**
- Stream graph shows flat/minimal variation
- Tooltip explains: "Fortified and Tyrannical were equally difficult this season."

---

## 4. Data Pipeline & Processing

### No Changes to Fetch Pipeline

- Do not modify `npm run fetch` script
- Do not change `public/data/affixes.json` structure
- Do not add new data files

### In-Browser Calculation

All affix analysis happens in the browser using existing data:

**Data sources:**
1. `public/data/dungeons.json` — dungeon metadata, expansion, season associations
2. `public/data/season-N.parquet` — leaderboard entries with `fortified` boolean and `period` field
3. `public/data/affixes.json` — affix manifest (season → period → affix list)

**Calculations (in `src/db/queries.ts` and `src/state.ts`):**

1. **Dungeon difficulty ranking** — MEDIAN(keystone_level) per dungeon, aggregated across season
2. **Fortified/Tyrannical split** — MEDIAN(keystone_level) grouped by dungeon and fortified boolean
3. **Secondary affix impact** — for each secondary affix:
   - Find all periods where affix was active
   - Calculate MEDIAN(keystone_level) for weeks with affix
   - Calculate MEDIAN(keystone_level) for weeks without affix
   - Delta = median_with - median_without
4. **Stream graph data** — per period, count or aggregate fortified/tyrannical occurrences
5. **Aggregate radial** — average impact deltas across selected dungeons

**Processing location:**
- `src/db/queries.ts` — new query functions for affix analysis
- `src/charts/affix.ts` — drill-down rendering and aggregation logic
- Browser-side computation only; no server calls

---

## 5. Layout

### Page Structure (Scrollable)

```
┌────────────────────────────────────────┐
│  Dungeon Browser                       │ (full width, ~300–400px height)
│  [Expansion groupings, dungeon rows]   │
├────────────────────────────────────────┤
│  Arc Chart (if 1 dungeon selected)     │ (full width, ~400–500px height)
│  [Progression line chart]              │
├────────────────────────────────────────┤
│  Affix Panel (if 1+ dungeons selected) │ (full width, scrollable content)
│  [Stream graph + radial charts]        │
└────────────────────────────────────────┘
```

**Responsive behavior:**
- On smaller screens: views stack fully vertically (standard scrolling)
- On larger screens: consider optional side-by-side layout (TBD)

### CSS & Styling

- Existing `src/style.css` — add classes for dungeon browser, expanded affix layout
- Dark theme (consistent with existing design)
- Sufficient padding/margins between views for visual separation
- Radial charts: ensure readable at stated sizes (120–300px)

---

## 6. Structure for Future Integration

**Future feature (not implemented now):** Cross-panel interactions

**Structure to enable:**
1. **Affix → Dungeon link** — clicking an affix in a radial could filter/select dungeons
   - Prepare: tag radial arms with affix ID, make clickable (no-op for now)
   - Future: wire to dungeon browser selection
2. **Dungeon browser → Arc/Affix routing** — already designed in
3. **State management** — ensure affixFilters, selectedDungeons state is accessible from other charts

---

## 7. Questions for Implementation

1. **Dungeon browser visual format** — list/rows or card grid?
2. **Radial arm direction for negative impact** — inward arms or outward with color distinction?
3. **Tooltip implementation** — D3-based or vanilla JS?
4. **Expand/collapse "view all" radials** — modal, in-place grid expansion, or separate panel?
5. **Affix color consistency** — map affix IDs to specific colors; consistent across all radials?

---

## Out of Scope

- Affix data for seasons 1–5 (no leaderboard data retained by Blizzard)
- Affix interaction analysis (e.g., "Bursting + Spiteful together = extra hard")
- Cross-season secondary affix comparisons (affix pools differ per season)
- Affix filtering on heatmap/arc chart (future integration)
- Exporting analysis data or sharing views

---

## Success Criteria

1. **Clarity:** A first-time user understands how to select dungeons and view affix impact without guidance
2. **Visual insight:** Radial charts clearly show which affixes are problematic/easy at a glance
3. **Performance:** All views render smoothly; radials update instantly on filter/selection changes
4. **Accessibility:** Hover tooltips provide exact values; all text legible (minimum ~11px)
5. **Academic quality:** Visualizations are non-standard and suitable for a data visualization course (radials, streams, not just bars)
