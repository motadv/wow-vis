# Arc Tooltip Multi-Season Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When no season is emphasized in the arc chart, hovering shows a combined tooltip card listing every season that has data at the hovered week, with key value and color-coded affixes per season.

**Architecture:** The `drawTooltip` function in `src/charts/arc.ts` already receives `emphasizedSeasonId`. We split the `mousemove` handler into two branches: the existing single-arc path (when a season is emphasized) and a new multi-arc path (when `emphasizedSeasonId === null`). A new `collectAtWeek` utility (in `arc-utils.ts`) handles the data-collection logic and is unit-tested. The single hover circle becomes an array of per-arc circles.

**Tech Stack:** D3.js, TypeScript strict, Vitest

---

### Task 1: Add and test `collectAtWeek` utility

**Files:**
- Modify: `src/utils/arc-utils.ts`
- Modify: `src/utils/arc-utils.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/utils/arc-utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeAverageArc, collectAtWeek } from './arc-utils.js';
import type { WeeklyArcRow } from '../types.js';

// ... existing computeAverageArc tests unchanged ...

describe('collectAtWeek', () => {
  it('returns empty array when no arcs have data at that week', () => {
    const arcs = [{ rows: [{ period_index: 1, period: 100, median_key: 10 }] }];
    expect(collectAtWeek(arcs, 5)).toEqual([]);
  });

  it('returns only arcs that have a row matching the given period_index', () => {
    const arcA = { rows: [{ period_index: 1, period: 100, median_key: 20 }] };
    const arcB = { rows: [{ period_index: 2, period: 200, median_key: 15 }] };
    const result = collectAtWeek([arcA, arcB], 1);
    expect(result).toHaveLength(1);
    expect(result[0].arc).toBe(arcA);
    expect(result[0].row.median_key).toBe(20);
  });

  it('sorts results by median_key descending', () => {
    const arcA = { rows: [{ period_index: 1, period: 100, median_key: 10 }] };
    const arcB = { rows: [{ period_index: 1, period: 200, median_key: 25 }] };
    const arcC = { rows: [{ period_index: 1, period: 300, median_key: 18 }] };
    const result = collectAtWeek([arcA, arcB, arcC], 1);
    expect(result.map((r) => r.row.median_key)).toEqual([25, 18, 10]);
  });

  it('returns all arcs when all have data at that week', () => {
    const arcA = { rows: [{ period_index: 3, period: 103, median_key: 22 }] };
    const arcB = { rows: [{ period_index: 3, period: 203, median_key: 19 }] };
    const result = collectAtWeek([arcA, arcB], 3);
    expect(result).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- --reporter=verbose src/utils/arc-utils.test.ts
```

Expected: `collectAtWeek` tests fail with "collectAtWeek is not a function".

- [ ] **Step 3: Implement `collectAtWeek` in `arc-utils.ts`**

Add after `computeAverageArc`:

```ts
export function collectAtWeek<T extends { rows: WeeklyArcRow[] }>(
  arcs: T[],
  periodIndex: number,
): Array<{ arc: T; row: WeeklyArcRow }> {
  const results: Array<{ arc: T; row: WeeklyArcRow }> = [];
  for (const arc of arcs) {
    const row = arc.rows.find((r) => r.period_index === periodIndex);
    if (row) results.push({ arc, row });
  }
  return results.sort((a, b) => b.row.median_key - a.row.median_key);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test -- --reporter=verbose src/utils/arc-utils.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/arc-utils.ts src/utils/arc-utils.test.ts
git commit -m "✨ Add collectAtWeek utility for multi-season tooltip"
```

---

### Task 2: Replace single `hoverCircle` with per-arc circles and update `mouseleave`

**Files:**
- Modify: `src/charts/arc.ts` — `drawTooltip` function

- [ ] **Step 1: Add the import**

At the top of `src/charts/arc.ts`, update the import from `arc-utils.js`:

```ts
import { computeAverageArc, collectAtWeek } from "../utils/arc-utils.js";
```

- [ ] **Step 2: Replace the single `hoverCircle` with an array**

Find this block (around line 610):

```ts
const hoverCircle = g.append("circle")
  .attr("r", 0)
  .attr("fill", "white")
  .attr("opacity", 0.9)
  .style("pointer-events", "none");
```

Replace with:

```ts
const hoverCircles = arcs.map(() =>
  g.append("circle")
    .attr("r", 0)
    .attr("fill", "white")
    .attr("opacity", 0.9)
    .style("pointer-events", "none")
);
```

- [ ] **Step 3: Update `mouseleave` to hide all circles**

Find this block (around line 720):

```ts
.on("mouseleave", () => {
  tooltipEl.style.display = "none";
  lastHoveredId = null;
  updatePathStyles(null);
  hoverCircle.attr("r", 0);
});
```

Replace with:

```ts
.on("mouseleave", () => {
  tooltipEl.style.display = "none";
  lastHoveredId = null;
  updatePathStyles(null);
  hoverCircles.forEach((c) => c.attr("r", 0));
});
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/charts/arc.ts
git commit -m "♻️ Replace single hoverCircle with per-arc circles in arc tooltip"
```

---

### Task 3: Implement the multi-arc `mousemove` branch

**Files:**
- Modify: `src/charts/arc.ts` — `mousemove` handler inside `drawTooltip`

Replace the entire `mousemove` handler (from `.on("mousemove", ...` through the closing `})`) with the following. The emphasized-season branch is the existing logic with two small renames (`dot` → `nameDot`, `label` → `nameLabel`, and the inner `color` variable in the affix loop → `affixColor`) to avoid shadowing. The multi-arc branch is new.

```ts
.on("mousemove", (event: MouseEvent) => {
  const [mx, my] = d3.pointer(event);
  const hovered = nearestArc(mx, my);
  if (hovered.season.id !== lastHoveredId) {
    lastHoveredId = hovered.season.id;
    updatePathStyles(lastHoveredId);
  }

  if (emphasizedSeasonId === null) {
    // Multi-arc mode: combined tooltip for all seasons at the hovered week
    const maxPeriods = Math.round(xScale.domain()[1]);
    const periodIndex = Math.max(1, Math.min(Math.round(xScale.invert(mx)), maxPeriods));
    const dataPoints = collectAtWeek(arcs, periodIndex);

    hoverCircles.forEach((circle, i) => {
      const row = arcs[i].rows.find((r) => r.period_index === periodIndex);
      if (row) {
        circle
          .attr("cx", xScale(row.period_index))
          .attr("cy", yScale(row.median_key))
          .attr("r", 5);
      } else {
        circle.attr("r", 0);
      }
    });

    if (dataPoints.length === 0) {
      tooltipEl.style.display = "none";
      return;
    }

    const svgX = MARGIN.left + xScale(periodIndex);
    const cardW = 220;
    const left =
      svgX + cardW + 16 > container.clientWidth
        ? svgX - cardW - 12
        : svgX + 12;
    const containerY = TITLE_H + MARGIN.top + my;
    const top = Math.max(TITLE_H + 4, containerY - 60);

    tooltipEl.style.display = "block";
    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;

    const weekEl = document.createElement("div");
    weekEl.style.cssText = `font-size:${FONT.small}px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#71717a;margin-bottom:6px`;
    weekEl.textContent = `Week ${periodIndex}`;

    const children: HTMLElement[] = [weekEl];
    const affixManifest = getAffixManifest();

    for (let i = 0; i < dataPoints.length; i++) {
      if (i > 0) {
        const sep = document.createElement("div");
        sep.style.cssText = "border-top:1px solid #3f3f46;margin:6px 0";
        children.push(sep);
      }

      const { arc, row } = dataPoints[i];
      const arcColor = colors[arc.colorIndex % colors.length];
      const affixEntries = affixManifest[arc.season.id]?.[row.period] ?? [];

      const seasonEl = document.createElement("div");
      seasonEl.style.cssText =
        "display:flex;align-items:center;gap:5px;margin-bottom:2px";
      const dot = document.createElement("span");
      dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${arcColor};display:inline-block;flex-shrink:0`;
      const seasonLabelEl = document.createElement("span");
      seasonLabelEl.style.cssText = `font-size:${FONT.small}px;color:#a1a1aa;flex:1`;
      seasonLabelEl.textContent = `S${arc.season.id}`;
      const keySpan = document.createElement("span");
      keySpan.style.cssText = `font-size:${FONT.small}px;font-weight:700;color:#e4e4e7`;
      keySpan.textContent = `+${row.median_key.toFixed(1)}`;
      seasonEl.appendChild(dot);
      seasonEl.appendChild(seasonLabelEl);
      seasonEl.appendChild(keySpan);

      const affixEl = document.createElement("div");
      affixEl.style.cssText = `font-size:${FONT.small}px;display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-left:13px`;
      if (affixEntries.length > 0) {
        for (const affix of affixEntries) {
          const affixSpan = document.createElement("span");
          affixSpan.style.cssText = `color:${getAffixColor(affix.id)};font-weight:500`;
          affixSpan.textContent = affix.name;
          affixEl.appendChild(affixSpan);
        }
      } else {
        affixEl.textContent = "—";
        affixEl.style.color = "#71717a";
      }

      children.push(seasonEl, affixEl);
    }

    tooltipEl.replaceChildren(...children);
    return;
  }

  // Emphasized / single-arc mode — existing behavior
  const idx = bisect(activeArc.rows, xScale.invert(mx));
  const row =
    activeArc.rows[Math.max(0, Math.min(idx, activeArc.rows.length - 1))];
  if (!row) return;

  const activeArcIndex = arcs.indexOf(activeArc);
  hoverCircles.forEach((circle, i) => {
    if (i === activeArcIndex) {
      circle
        .attr("cx", xScale(row.period_index))
        .attr("cy", yScale(row.median_key))
        .attr("r", 5);
    } else {
      circle.attr("r", 0);
    }
  });

  const svgX = MARGIN.left + xScale(row.period_index);
  const cardW = 180;
  const left =
    svgX + cardW + 16 > container.clientWidth
      ? svgX - cardW - 12
      : svgX + 12;

  const containerY = TITLE_H + MARGIN.top + my;
  const tooltipH = 120;
  const top = Math.max(TITLE_H + 4, containerY - tooltipH - 12);

  tooltipEl.style.display = "block";
  tooltipEl.style.left = `${left}px`;
  tooltipEl.style.top = `${top}px`;

  const weekEl = document.createElement("div");
  weekEl.style.cssText = `font-size:${FONT.small}px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#71717a`;
  weekEl.textContent = `Week ${row.period_index}`;

  const seasonKeys = activeArc.rows
    .map((r) => r.median_key)
    .sort((a, b) => a - b);
  const seasonMedian =
    seasonKeys.length % 2 === 0
      ? (seasonKeys[seasonKeys.length / 2 - 1] +
          seasonKeys[seasonKeys.length / 2]) /
        2
      : seasonKeys[Math.floor(seasonKeys.length / 2)];
  const delta = row.median_key - seasonMedian;
  const keyColor = cellStyle(delta).text;

  const keyEl = document.createElement("div");
  keyEl.style.cssText = `font-size:${FONT.large}px;font-weight:700;display:flex;align-items:baseline;gap:6px`;
  const keySpan = document.createElement("span");
  keySpan.style.cssText = `color:${keyColor}`;
  keySpan.textContent = `+${row.median_key.toFixed(1)}`;
  keyEl.appendChild(keySpan);
  const medianSpan = document.createElement("span");
  medianSpan.style.cssText = `font-size:${FONT.small}px;color:#71717a;font-weight:400`;
  medianSpan.textContent = `(${seasonMedian.toFixed(1)})`;
  keyEl.appendChild(medianSpan);

  const nameEl = document.createElement("div");
  nameEl.style.cssText = `font-size:${FONT.small}px;color:#a1a1aa;display:flex;align-items:center;gap:5px`;
  const nameDot = document.createElement("span");
  nameDot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0`;
  const nameLabel = document.createElement("span");
  nameLabel.textContent = seasonLabel;
  nameEl.appendChild(nameDot);
  nameEl.appendChild(nameLabel);

  const affixManifest = getAffixManifest();
  const affixEntries = affixManifest[activeArc.season.id]?.[row.period] ?? [];
  const affixEl = document.createElement("div");
  affixEl.style.cssText = `font-size:${FONT.small}px;margin-top:3px;display:flex;flex-wrap:wrap;gap:6px;align-items:center`;
  if (affixEntries.length > 0) {
    for (const affix of affixEntries) {
      const affixSpan = document.createElement("span");
      const impactDelta = activeArc.secondaryAffixImpact.get(affix.id);
      const affixColor = getAffixColor(affix.id, impactDelta);
      affixSpan.style.cssText = `color:${affixColor};font-weight:500`;
      affixSpan.textContent = affix.name;
      affixEl.appendChild(affixSpan);
    }
  } else {
    affixEl.textContent = "—";
    affixEl.style.color = "#71717a";
  }

  tooltipEl.replaceChildren(weekEl, keyEl, nameEl, affixEl);
})
```

- [ ] **Step 1: Apply the replacement above**

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. If TypeScript complains about `noUnusedLocals` on `color` or `seasonLabel` (now only used in the emphasized branch), confirm those variables are still referenced in the emphasized branch — they are.

- [ ] **Step 3: Run all tests**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/charts/arc.ts
git commit -m "✨ Show combined multi-season tooltip when no arc is emphasized"
```

---

### Task 4: Manual verification

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify multi-arc mode**

Select a dungeon that appears in multiple seasons (e.g. any dungeon from the heatmap). With no season emphasized (no arc clicked), hover over the arc chart. Confirm:
- Tooltip shows "Week N" header.
- One entry per season that has data at that week (colored dot · season label · key value).
- Affix names shown below each season entry in their colors.
- Seasons with no data at that week are absent.
- A hover dot appears on each arc at that week's position.

- [ ] **Step 3: Verify emphasized mode is unchanged**

Click an arc line to emphasize a season. Hover the chart. Confirm:
- Single-season tooltip appears with key value, delta coloring, season median, and affix names with impact delta coloring.
- Only one hover circle appears (on the emphasized arc).

- [ ] **Step 4: Verify mouseleave**

Move the mouse off the chart. Confirm all hover circles disappear and the tooltip hides.
