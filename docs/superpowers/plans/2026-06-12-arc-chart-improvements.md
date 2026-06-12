# Arc Chart Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the arc chart in `src/charts/arc.ts` with 8 UX features: season-end markers, hover tooltip, axis label, larger fonts, dot markers, peak annotation, end-of-line labels, and grid lines.

**Architecture:** `renderArc` is split into three focused sub-functions — `drawAxes`, `drawLines`, `drawTooltip` — each called in sequence. `initArc` and the public `setKeyDomain` export are untouched. The right-side D3 legend is removed; end-of-line season abbreviation labels replace it.

**Tech Stack:** D3 v7 (d3-scale, d3-axis, d3-bisect, d3-selection), TypeScript strict mode (`noUnusedLocals`, `noUnusedParameters`).

**Note on MARGIN.right:** The spec says "~20px" but end-of-line labels need room. This plan uses `MARGIN.right = 60` (fits ~50px of label text). `MARGIN.bottom` increases from 36 → 50 to accommodate the new X-axis label.

---

### Task 1: Update MARGIN constants, add `seasonAbbrev`, restructure `renderArc`

This task is a pure refactor — same visual output (minus the right legend) — that establishes the sub-function skeleton for Tasks 2–4.

**Files:**
- Modify: `src/charts/arc.ts`

- [ ] **Step 1: Replace the MARGIN constant**

In `src/charts/arc.ts`, line 10:

```typescript
// Before
const MARGIN = { top: 20, right: 140, bottom: 36, left: 44 };

// After
const MARGIN = { top: 20, right: 60, bottom: 50, left: 44 };
```

- [ ] **Step 2: Replace `renderArc` and add sub-function stubs**

Delete the entire existing `renderArc` function and the `legendG` block. Replace with:

```typescript
function renderArc(
  container: HTMLElement,
  title: string,
  arcs: ArcEntry[],
  emphasizedSeasonId: number | null,
): void {
  container.replaceChildren();
  if (arcs.length === 0 || arcs.every(a => a.rows.length === 0)) return;

  container.style.position = 'relative';

  const titleEl = document.createElement('div');
  titleEl.style.cssText =
    'padding:14px 16px 0;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#e4e4e7';
  titleEl.textContent = `${title} — Median Key Level per Week`;
  container.appendChild(titleEl);

  const colors = d3.schemeTableau10 as readonly string[];
  const width = container.clientWidth - MARGIN.left - MARGIN.right;
  const height = container.clientHeight - MARGIN.top - MARGIN.bottom - TITLE_H;
  const maxPeriods = Math.max(...arcs.map(a => a.rows.length));

  const xScale = d3.scaleLinear().domain([1, maxPeriods]).range([0, width]);
  const yScale = d3.scaleLinear().domain(keyDomain).range([height, 0]);

  const line = d3.line<WeeklyArcRow>()
    .x(r => xScale(r.period_index))
    .y(r => yScale(r.median_key))
    .curve(d3.curveMonotoneX);

  const svg = d3.select(container)
    .append('svg')
    .attr('width', container.clientWidth)
    .attr('height', container.clientHeight - TITLE_H)
    .style('font-family', 'sans-serif');

  const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  drawAxes(g, xScale, yScale, height, width);
  drawLines(g, arcs, xScale, yScale, height, emphasizedSeasonId, colors, line);
  drawTooltip(g, arcs, xScale, width, height, emphasizedSeasonId, colors, container);
}
```

- [ ] **Step 3: Add `drawAxes` with existing axis code (fonts unchanged for now)**

Add after `renderArc`:

```typescript
function drawAxes(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  height: number,
  width: number,
): void {
  const maxPeriods = Math.round(xScale.domain()[1]);

  g.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale).ticks(Math.min(maxPeriods, 10)).tickFormat(d => `W${d}`))
    .call(ax => ax.select('.domain').attr('stroke', '#3f3f46'))
    .call(ax => ax.selectAll('text').attr('fill', '#a1a1aa').attr('font-size', 10))
    .call(ax => ax.selectAll('line').attr('stroke', '#3f3f46'));

  g.append('g')
    .call(d3.axisLeft(yScale).ticks(5))
    .call(ax => ax.select('.domain').attr('stroke', '#3f3f46'))
    .call(ax => ax.selectAll('text').attr('fill', '#a1a1aa').attr('font-size', 10))
    .call(ax => ax.selectAll('line').attr('stroke', '#3f3f46'));

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -34)
    .attr('text-anchor', 'middle')
    .attr('font-size', 10)
    .attr('fill', '#71717a')
    .text('Median Key');

  // width parameter unused until Task 2 — suppress lint warning via reference
  void width;
}
```

- [ ] **Step 4: Add `drawLines` with existing line code (no legend)**

```typescript
function drawLines(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  arcs: ArcEntry[],
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  height: number,
  emphasizedSeasonId: number | null,
  colors: readonly string[],
  line: d3.Line<WeeklyArcRow>,
): void {
  for (const { season, rows, colorIndex } of arcs) {
    if (rows.length === 0) continue;
    const emphasized = emphasizedSeasonId === null || season.id === emphasizedSeasonId;
    g.append('path')
      .datum(rows)
      .attr('fill', 'none')
      .attr('stroke', colors[colorIndex % colors.length])
      .attr('stroke-width', emphasized ? 2.5 : 1.5)
      .attr('opacity', emphasized ? 1 : 0.3)
      .attr('d', line);

    // season, xScale, yScale, height used in Task 3
    void season; void xScale; void yScale; void height;
  }
}
```

- [ ] **Step 5: Add empty `drawTooltip` stub**

```typescript
function drawTooltip(
  _g: d3.Selection<SVGGElement, unknown, null, undefined>,
  _arcs: ArcEntry[],
  _xScale: d3.ScaleLinear<number, number>,
  _width: number,
  _height: number,
  _emphasizedSeasonId: number | null,
  _colors: readonly string[],
  _container: HTMLElement,
): void {}
```

- [ ] **Step 6: Add `seasonAbbrev` helper at the bottom of the file**

```typescript
function seasonAbbrev(season: SeasonMeta): string {
  const m = season.name.match(/\((.+?) Season (\d+)\)/);
  if (!m) return `S${season.id}`;
  const expansions: Record<string, string> = {
    Shadowlands: 'SL',
    Dragonflight: 'DF',
    'The War Within': 'TWW',
  };
  return `${expansions[m[1]] ?? m[1]} S${m[2]}`;
}
```

- [ ] **Step 7: Type-check**

```bash
npm run build
```

Expected: no TypeScript errors. The chart is still functional — lines render, right legend is gone, margins are wider.

- [ ] **Step 8: Commit**

```bash
git add src/charts/arc.ts
git commit -m "♻️ Refactor renderArc into drawAxes/drawLines/drawTooltip stubs"
```

---

### Task 2: Axis improvements in `drawAxes`

**Files:**
- Modify: `src/charts/arc.ts` — `drawAxes` function only

- [ ] **Step 1: Replace `drawAxes` with the full improved version**

Replace the entire `drawAxes` function:

```typescript
function drawAxes(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  height: number,
  width: number,
): void {
  const maxPeriods = Math.round(xScale.domain()[1]);

  // Horizontal grid lines — drawn first so they appear behind everything
  yScale.ticks(5).forEach(tick => {
    g.append('line')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', yScale(tick)).attr('y2', yScale(tick))
      .attr('stroke', '#27272a')
      .attr('stroke-width', 1)
      .style('pointer-events', 'none');
  });

  g.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale).ticks(Math.min(maxPeriods, 10)).tickFormat(d => `W${d}`))
    .call(ax => ax.select('.domain').attr('stroke', '#3f3f46'))
    .call(ax => ax.selectAll('text').attr('fill', '#a1a1aa').attr('font-size', 12))
    .call(ax => ax.selectAll('line').attr('stroke', '#3f3f46'));

  g.append('g')
    .call(d3.axisLeft(yScale).ticks(5))
    .call(ax => ax.select('.domain').attr('stroke', '#3f3f46'))
    .call(ax => ax.selectAll('text').attr('fill', '#a1a1aa').attr('font-size', 12))
    .call(ax => ax.selectAll('line').attr('stroke', '#3f3f46'));

  // Y-axis label
  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -34)
    .attr('text-anchor', 'middle')
    .attr('font-size', 12)
    .attr('fill', '#71717a')
    .text('Median Key');

  // X-axis label
  g.append('text')
    .attr('x', width / 2)
    .attr('y', height + 38)
    .attr('text-anchor', 'middle')
    .attr('font-size', 12)
    .attr('fill', '#71717a')
    .text('Week of Season');
}
```

- [ ] **Step 2: Run the dev server and verify visually**

```bash
npm run dev
```

Open the app, select any dungeon. Expected:
- Tick labels are larger (12px)
- "Week of Season" label appears below the X-axis
- "Median Key" label is larger
- Subtle horizontal grid lines appear at Y-axis ticks

- [ ] **Step 3: Commit**

```bash
git add src/charts/arc.ts
git commit -m "✨ Improve arc axes: larger fonts, X-axis label, grid lines"
```

---

### Task 3: Line improvements in `drawLines`

Adds dot markers, season-end dashed vertical markers, end-of-line season labels, and peak annotation. Removes the `void` lint suppressors from Task 1.

**Files:**
- Modify: `src/charts/arc.ts` — `drawLines` function only

- [ ] **Step 1: Replace `drawLines` with the full improved version**

```typescript
function drawLines(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  arcs: ArcEntry[],
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  height: number,
  emphasizedSeasonId: number | null,
  colors: readonly string[],
  line: d3.Line<WeeklyArcRow>,
): void {
  for (const { season, rows, colorIndex } of arcs) {
    if (rows.length === 0) continue;
    const emphasized = emphasizedSeasonId === null || season.id === emphasizedSeasonId;
    const color = colors[colorIndex % colors.length];

    // Season line path
    g.append('path')
      .datum(rows)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', emphasized ? 2.5 : 1.5)
      .attr('opacity', emphasized ? 1 : 0.3)
      .attr('d', line);

    // Dot markers at each data point
    for (const row of rows) {
      g.append('circle')
        .attr('cx', xScale(row.period_index))
        .attr('cy', yScale(row.median_key))
        .attr('r', 3)
        .attr('fill', color)
        .attr('opacity', emphasized ? 1 : 0.3)
        .style('pointer-events', 'none');
    }

    // Season-end dashed vertical marker
    const lastRow = rows[rows.length - 1];
    const endX = xScale(lastRow.period_index);
    g.append('line')
      .attr('x1', endX).attr('x2', endX)
      .attr('y1', 0).attr('y2', height)
      .attr('stroke', color)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3')
      .attr('opacity', 0.7)
      .style('pointer-events', 'none');

    // End-of-line season label (replaces right-side legend)
    g.append('text')
      .attr('x', endX + 4)
      .attr('y', yScale(lastRow.median_key))
      .attr('font-size', 11)
      .attr('fill', color)
      .attr('dominant-baseline', 'middle')
      .attr('opacity', emphasized ? 1 : 0.5)
      .style('pointer-events', 'none')
      .text(seasonAbbrev(season));
  }

  // Peak annotation — only when a season is emphasized to avoid clutter
  if (emphasizedSeasonId !== null) {
    const emphArc = arcs.find(a => a.season.id === emphasizedSeasonId);
    if (emphArc && emphArc.rows.length > 0) {
      const peak = emphArc.rows.reduce((best, r) =>
        r.median_key > best.median_key ? r : best,
      );
      const color = colors[emphArc.colorIndex % colors.length];
      g.append('text')
        .attr('x', xScale(peak.period_index))
        .attr('y', yScale(peak.median_key) - 14)
        .attr('text-anchor', 'middle')
        .attr('font-size', 11)
        .attr('font-weight', '700')
        .attr('fill', color)
        .style('pointer-events', 'none')
        .text(`▲ +${peak.median_key.toFixed(1)}`);
    }
  }
}
```

- [ ] **Step 2: Run the dev server and verify visually**

```bash
npm run dev
```

Select a dungeon that appears in multiple seasons (e.g. click any tile in the heatmap with two season rows for the same dungeon). Expected:
- Small dots appear at each weekly data point on all lines
- Dashed vertical line at the right end of each season's line, matching the line's color
- Season abbreviation (e.g. "DF S3") appears just to the right of the last dot
- No right-side legend visible
- Click a tile to emphasize a season → "▲ +N.N" peak label appears above the highest point
- Click background / a different dungeon → peak label disappears (not emphasized)

- [ ] **Step 3: Type-check**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/charts/arc.ts
git commit -m "✨ Add arc dot markers, season-end markers, end-of-line labels, peak annotation"
```

---

### Task 4: Implement `drawTooltip`

**Files:**
- Modify: `src/charts/arc.ts` — `drawTooltip` function only

- [ ] **Step 1: Replace the `drawTooltip` stub with the full implementation**

```typescript
function drawTooltip(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  arcs: ArcEntry[],
  xScale: d3.ScaleLinear<number, number>,
  width: number,
  height: number,
  emphasizedSeasonId: number | null,
  colors: readonly string[],
  container: HTMLElement,
): void {
  // Use emphasized season if set; otherwise fall back to longest season
  const activeArc =
    emphasizedSeasonId !== null
      ? (arcs.find(a => a.season.id === emphasizedSeasonId) ??
         arcs.reduce((best, a) => (a.rows.length > best.rows.length ? a : best)))
      : arcs.reduce((best, a) => (a.rows.length > best.rows.length ? a : best));

  if (!activeArc || activeArc.rows.length === 0) return;

  const color = colors[activeArc.colorIndex % colors.length];
  const seasonLabel = activeArc.season.name
    .replace('Mythic+ Dungeons (', '')
    .replace(')', '');
  const bisect = d3.bisector<WeeklyArcRow, number>(r => r.period_index).center;

  const tooltipEl = document.createElement('div');
  tooltipEl.style.cssText =
    'position:absolute;background:#1c1c1f;border:1px solid #52525b;border-radius:6px;' +
    'padding:10px 13px;font-size:12px;color:#e4e4e7;line-height:1.7;' +
    'box-shadow:0 4px 16px rgba(0,0,0,0.5);pointer-events:none;display:none;' +
    'font-family:sans-serif;white-space:nowrap';
  container.appendChild(tooltipEl);

  g.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', 'none')
    .style('pointer-events', 'all')
    .on('mousemove', (event: MouseEvent) => {
      const [mx] = d3.pointer(event);
      const idx = bisect(activeArc.rows, xScale.invert(mx));
      const row = activeArc.rows[Math.max(0, Math.min(idx, activeArc.rows.length - 1))];
      if (!row) return;

      const svgX = MARGIN.left + xScale(row.period_index);
      const cardW = 150;
      const left =
        svgX + cardW + 16 > container.clientWidth ? svgX - cardW - 12 : svgX + 12;

      tooltipEl.style.display = 'block';
      tooltipEl.style.left = `${left}px`;
      tooltipEl.style.top = `${TITLE_H + MARGIN.top + 4}px`;
      tooltipEl.innerHTML =
        `<div style="font-size:11px;font-weight:700;text-transform:uppercase;` +
        `letter-spacing:0.08em;color:#71717a">Week ${row.period_index}</div>` +
        `<div style="font-size:16px;font-weight:700;color:${color}">` +
        `+${row.median_key.toFixed(1)}</div>` +
        `<div style="font-size:11px;color:#a1a1aa;display:flex;align-items:center;gap:5px">` +
        `<span style="width:8px;height:8px;border-radius:50%;background:${color};` +
        `display:inline-block;flex-shrink:0"></span>${seasonLabel}</div>`;
    })
    .on('mouseleave', () => {
      tooltipEl.style.display = 'none';
    });
}
```

- [ ] **Step 2: Verify the build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Run the dev server and verify tooltip behavior**

```bash
npm run dev
```

Select a dungeon. Move the mouse slowly across the chart lines. Expected:
- Tooltip card appears near the cursor showing "Week N", "+N.N" in the season color, and the season name with a color dot
- Tooltip snaps to the nearest weekly data point (not continuous — it jumps)
- Moving to the right edge of the chart: tooltip card flips to appear on the left side of the cursor
- Moving the mouse off the chart area: tooltip disappears

- [ ] **Step 4: Commit**

```bash
git add src/charts/arc.ts
git commit -m "✨ Add arc chart hover tooltip"
```

---

## Self-Review

**Spec coverage check:**

| Spec feature | Task |
|---|---|
| Season-end vertical markers | Task 3 |
| Detailed card tooltip | Task 4 |
| X-axis label "Week of Season" | Task 2 |
| Larger axis fonts (10→12px) | Task 2 |
| Dot markers on data points | Task 3 |
| Peak annotation (emphasized season only) | Task 3 |
| End-of-line season labels / remove legend | Task 3 |
| Horizontal grid lines | Task 2 |

All 8 features covered. ✓

**Known deviation from spec:** `MARGIN.right` is 60 (not "~20") to give end-of-line labels enough room. `MARGIN.bottom` is 50 (not 36) to give the X-axis label room below tick labels. Both were necessary practical adjustments.
