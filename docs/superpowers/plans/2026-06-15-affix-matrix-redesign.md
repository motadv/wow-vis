# Affix Matrix Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken stream graph + radial chart in the affix panel with a unified Affix Impact Matrix that shows how each affix affects a selected dungeon's median key level across all seasons.

**Architecture:** Two new query functions feed raw delta data into a pure `buildAffixMatrixData` assembler that produces `AffixMatrixData`; a DOM-based `renderAffixMatrix` renderer draws the interactive table; `affix.ts` is simplified to wire these three pieces together and drop multi-dungeon support. The two old chart files are deleted after `affix.ts` no longer imports them.

**Tech Stack:** TypeScript, DuckDB-Wasm (existing), D3 not needed for the matrix (plain DOM), Vitest for unit tests on pure functions.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/types.ts` | Modify | Add `AffixMatrixRow`, `AffixMatrixData` interfaces |
| `src/db/queries.ts` | Modify | Add `getPrimaryAffixDeltaBySeason`, `getSecondaryAffixImpactAllSeasons` |
| `src/charts/affix-matrix.ts` | Create | `cellStyle`, `buildAffixMatrixData`, `renderAffixMatrix` |
| `src/charts/affix-matrix.test.ts` | Create | Unit tests for `cellStyle` and `buildAffixMatrixData` |
| `src/charts/affix.ts` | Rewrite | Single-dungeon wiring only, no season selector strip |
| `src/charts/affix-stream.ts` | Delete | Replaced by matrix |
| `src/charts/affix-radial.ts` | Delete | Replaced by matrix |

---

## Task 1: Add types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add interfaces after the existing `PrimaryAffixTrendPoint` interface**

Open `src/types.ts` and append these two interfaces after line 75 (`PrimaryAffixTrendPoint`):

```typescript
export interface AffixMatrixRow {
  affixId: number;
  affixName: string;
  isPrimary: boolean;
  isFortified?: boolean;                    // set only on primary rows
  cells: Record<number, number | null>;     // seasonId → delta (null = dungeon not in season)
  avgDelta: number;                         // arithmetic mean across seasons with data
}

export interface AffixMatrixData {
  dungeonId: number;
  seasonIds: number[];    // seasons where dungeon appears, ascending, pre-S13 only
  rows: AffixMatrixRow[]; // primary rows first, then secondary sorted by |avgDelta| desc
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "✨ Add AffixMatrixRow and AffixMatrixData types"
```

---

## Task 2: Add `getPrimaryAffixDeltaBySeason`

**Files:**
- Modify: `src/db/queries.ts`

- [ ] **Step 1: Add the function at the end of `src/db/queries.ts`**

```typescript
export async function getPrimaryAffixDeltaBySeason(
  conn: AsyncDuckDBConnection,
  dungeonId: number,
  seasonIds: number[],
): Promise<Array<{ seasonId: number; fortifiedDelta: number; tyrannicalDelta: number }>> {
  return Promise.all(
    seasonIds.map(async seasonId => {
      const result = await conn.query(`
        SELECT
          MEDIAN(keystone_level)::FLOAT                                   AS baseline,
          MEDIAN(CASE WHEN fortified     THEN keystone_level END)::FLOAT  AS fort_median,
          MEDIAN(CASE WHEN NOT fortified THEN keystone_level END)::FLOAT  AS tyrant_median
        FROM leaderboard_${seasonId}
        WHERE dungeon_id = ${dungeonId}
      `);
      const row = result.toArray()[0];
      const baseline = Number(row.baseline);
      return {
        seasonId,
        fortifiedDelta:  Number(row.fort_median)   - baseline,
        tyrannicalDelta: Number(row.tyrant_median) - baseline,
      };
    }),
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/db/queries.ts
git commit -m "✨ Add getPrimaryAffixDeltaBySeason query"
```

---

## Task 3: Add `getSecondaryAffixImpactAllSeasons`

**Files:**
- Modify: `src/db/queries.ts`

- [ ] **Step 1: Add the function at the end of `src/db/queries.ts`**

```typescript
export async function getSecondaryAffixImpactAllSeasons(
  conn: AsyncDuckDBConnection,
  dungeonId: number,
  seasonIds: number[],
): Promise<Array<{ affixId: number; affixName: string; cells: Record<number, number>; avgDelta: number }>> {
  const perSeason = await Promise.all(
    seasonIds.map(async seasonId => ({
      seasonId,
      impacts: await getSecondaryAffixImpact(conn, dungeonId, seasonId),
    })),
  );

  const affixMap = new Map<number, { name: string; cells: Record<number, number> }>();
  for (const { seasonId, impacts } of perSeason) {
    for (const { affixId, affixName, impactDelta } of impacts) {
      if (!affixMap.has(affixId)) {
        affixMap.set(affixId, { name: affixName, cells: {} });
      }
      affixMap.get(affixId)!.cells[seasonId] = impactDelta;
    }
  }

  return Array.from(affixMap.entries()).map(([affixId, data]) => {
    const values = Object.values(data.cells);
    const avgDelta = values.reduce((a, b) => a + b, 0) / values.length;
    return { affixId, affixName: data.name, cells: data.cells, avgDelta };
  });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/db/queries.ts
git commit -m "✨ Add getSecondaryAffixImpactAllSeasons query"
```

---

## Task 4: Create `affix-matrix.ts` with tests

**Files:**
- Create: `src/charts/affix-matrix.ts`
- Create: `src/charts/affix-matrix.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/charts/affix-matrix.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { cellStyle, buildAffixMatrixData } from './affix-matrix.js';

describe('cellStyle', () => {
  it('returns dark neutral for null', () => {
    expect(cellStyle(null)).toEqual({ bg: '#1a1a22', text: '#2e2e38' });
  });
  it('returns darkest red for large negative delta', () => {
    expect(cellStyle(-2.0)).toEqual({ bg: '#7f1d1d', text: '#fca5a5' });
  });
  it('returns bright red for moderate negative delta', () => {
    expect(cellStyle(-0.5)).toEqual({ bg: '#dc2626', text: '#fca5a5' });
  });
  it('returns grey for near-zero negative delta', () => {
    expect(cellStyle(-0.1)).toEqual({ bg: '#27272a', text: '#71717a' });
  });
  it('returns grey for zero', () => {
    expect(cellStyle(0)).toEqual({ bg: '#27272a', text: '#71717a' });
  });
  it('returns light green for small positive delta (t=0.08)', () => {
    expect(cellStyle(0.12)).toEqual({ bg: '#166534', text: '#86efac' });
  });
  it('returns darkest green for large positive delta', () => {
    expect(cellStyle(2.0)).toEqual({ bg: '#064e3b', text: '#34d399' });
  });
});

describe('buildAffixMatrixData', () => {
  it('places Tyrannical then Fortified as first two rows', () => {
    const result = buildAffixMatrixData(
      1,
      [7, 8],
      [
        { seasonId: 7, fortifiedDelta: 1.0, tyrannicalDelta: -1.0 },
        { seasonId: 8, fortifiedDelta: 1.2, tyrannicalDelta: -1.2 },
      ],
      [],
    );
    expect(result.rows[0].affixName).toBe('Tyrannical');
    expect(result.rows[0].isPrimary).toBe(true);
    expect(result.rows[0].isFortified).toBe(false);
    expect(result.rows[1].affixName).toBe('Fortified');
    expect(result.rows[1].isFortified).toBe(true);
  });

  it('fills null for seasons where a secondary affix has no data', () => {
    const result = buildAffixMatrixData(
      1,
      [7, 8],
      [],
      [{ affixId: 5, affixName: 'Bolstering', cells: { 7: -1.5 }, avgDelta: -1.5 }],
    );
    const row = result.rows.find(r => r.affixName === 'Bolstering')!;
    expect(row.cells[7]).toBe(-1.5);
    expect(row.cells[8]).toBeNull();
  });

  it('sorts secondary rows by |avgDelta| descending', () => {
    const result = buildAffixMatrixData(
      1,
      [7],
      [],
      [
        { affixId: 5, affixName: 'Volcanic',   cells: { 7:  0.5  }, avgDelta:  0.5  },
        { affixId: 6, affixName: 'Bolstering', cells: { 7: -1.6  }, avgDelta: -1.6  },
        { affixId: 7, affixName: 'Necrotic',   cells: { 7: -0.3  }, avgDelta: -0.3  },
      ],
    );
    const secondary = result.rows.filter(r => !r.isPrimary);
    expect(secondary[0].affixName).toBe('Bolstering');
    expect(secondary[1].affixName).toBe('Volcanic');
    expect(secondary[2].affixName).toBe('Necrotic');
  });

  it('computes avgDelta for primary rows as mean of seasonal deltas', () => {
    const result = buildAffixMatrixData(
      1,
      [7, 8],
      [
        { seasonId: 7, fortifiedDelta: 1.0, tyrannicalDelta: -1.0 },
        { seasonId: 8, fortifiedDelta: 1.4, tyrannicalDelta: -1.4 },
      ],
      [],
    );
    const tyrant = result.rows.find(r => r.affixName === 'Tyrannical')!;
    expect(tyrant.avgDelta).toBeCloseTo(-1.2);
    const fort = result.rows.find(r => r.affixName === 'Fortified')!;
    expect(fort.avgDelta).toBeCloseTo(1.2);
  });
});
```

- [ ] **Step 2: Run tests — expect failures (module not found)**

```bash
npm run test -- --reporter=verbose src/charts/affix-matrix.test.ts
```

Expected: FAIL — `Cannot find module './affix-matrix.js'`

- [ ] **Step 3: Create `src/charts/affix-matrix.ts`**

```typescript
import type { AffixMatrixData, AffixMatrixRow } from '../types.js';

export const MAX_DELTA = 1.5;

// Sentinel IDs matching Blizzard's affix IDs filtered in getSecondaryAffixImpact
const TYRANNICAL_AFFIX_ID = 9;
const FORTIFIED_AFFIX_ID  = 10;

export function cellStyle(delta: number | null): { bg: string; text: string } {
  if (delta === null) return { bg: '#1a1a22', text: '#2e2e38' };
  const t = Math.max(-1, Math.min(1, delta / MAX_DELTA));
  if      (t <= -0.70) return { bg: '#7f1d1d', text: '#fca5a5' };
  else if (t <= -0.45) return { bg: '#991b1b', text: '#fca5a5' };
  else if (t <= -0.15) return { bg: '#dc2626', text: '#fca5a5' };
  else if (t <   0.08) return { bg: '#27272a', text: '#71717a' };
  else if (t <   0.15) return { bg: '#166534', text: '#86efac' };
  else if (t <   0.45) return { bg: '#15803d', text: '#6ee7b7' };
  else if (t <   0.70) return { bg: '#059669', text: '#6ee7b7' };
  else                  return { bg: '#064e3b', text: '#34d399' };
}

export function buildAffixMatrixData(
  dungeonId: number,
  seasonIds: number[],
  primaryDeltas: Array<{ seasonId: number; fortifiedDelta: number; tyrannicalDelta: number }>,
  secondaryData: Array<{ affixId: number; affixName: string; cells: Record<number, number>; avgDelta: number }>,
): AffixMatrixData {
  const tyrannicalCells: Record<number, number | null> = Object.fromEntries(seasonIds.map(s => [s, null]));
  const fortifiedCells:  Record<number, number | null> = Object.fromEntries(seasonIds.map(s => [s, null]));

  for (const { seasonId, fortifiedDelta, tyrannicalDelta } of primaryDeltas) {
    tyrannicalCells[seasonId] = tyrannicalDelta;
    fortifiedCells[seasonId]  = fortifiedDelta;
  }

  const mean = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const primaryRows: AffixMatrixRow[] = [
    {
      affixId: TYRANNICAL_AFFIX_ID,
      affixName: 'Tyrannical',
      isPrimary: true,
      isFortified: false,
      cells: tyrannicalCells,
      avgDelta: mean(primaryDeltas.map(d => d.tyrannicalDelta)),
    },
    {
      affixId: FORTIFIED_AFFIX_ID,
      affixName: 'Fortified',
      isPrimary: true,
      isFortified: true,
      cells: fortifiedCells,
      avgDelta: mean(primaryDeltas.map(d => d.fortifiedDelta)),
    },
  ];

  const secondaryRows: AffixMatrixRow[] = secondaryData
    .map(({ affixId, affixName, cells, avgDelta }) => ({
      affixId,
      affixName,
      isPrimary: false as const,
      cells: Object.fromEntries(seasonIds.map(s => [s, cells[s] ?? null])) as Record<number, number | null>,
      avgDelta,
    }))
    .sort((a, b) => Math.abs(b.avgDelta) - Math.abs(a.avgDelta));

  return { dungeonId, seasonIds, rows: [...primaryRows, ...secondaryRows] };
}

function fmt(d: number | null): string {
  if (d === null) return '—';
  return (d >= 0 ? '+' : '') + d.toFixed(2);
}

export function renderAffixMatrix(
  container: HTMLElement,
  data: AffixMatrixData,
  onSeasonSelect: (seasonId: number | null) => void,
): void {
  let selectedCol: number | 'avg' = 'avg';

  function render(): void {
    container.innerHTML = '';
    const table = document.createElement('table');
    table.style.cssText = 'border-collapse:separate;border-spacing:3px;width:100%;';

    // Header row
    const thead = document.createElement('thead');
    const hRow = document.createElement('tr');
    hRow.appendChild(document.createElement('th'));

    for (const seasonId of data.seasonIds) {
      const th = document.createElement('th');
      th.textContent = `S${seasonId}`;
      const isActive = selectedCol === seasonId;
      th.style.cssText = `padding:5px 8px;font-size:10px;font-weight:700;text-align:center;cursor:pointer;border-radius:4px;color:${isActive ? '#93c5fd' : '#71717a'};background:${isActive ? 'rgba(59,130,246,0.15)' : 'transparent'};`;
      th.onclick = () => { selectedCol = seasonId; onSeasonSelect(seasonId); render(); };
      hRow.appendChild(th);
    }

    const avgTh = document.createElement('th');
    avgTh.textContent = 'AVG';
    const avgActive = selectedCol === 'avg';
    avgTh.style.cssText = `padding:5px 12px;font-size:10px;font-weight:700;text-align:center;cursor:pointer;border-radius:4px;border-left:2px solid #27272a;color:${avgActive ? '#c4b5fd' : '#71717a'};background:${avgActive ? 'rgba(139,92,246,0.18)' : 'transparent'};`;
    avgTh.onclick = () => { selectedCol = 'avg'; onSeasonSelect(null); render(); };
    hRow.appendChild(avgTh);
    thead.appendChild(hRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const primaryRows = data.rows.filter(r => r.isPrimary);
    const secondaryRows = [...data.rows.filter(r => !r.isPrimary)].sort((a, b) => {
      const aVal = selectedCol === 'avg' ? a.avgDelta : (a.cells[selectedCol as number] ?? 0);
      const bVal = selectedCol === 'avg' ? b.avgDelta : (b.cells[selectedCol as number] ?? 0);
      return Math.abs(bVal) - Math.abs(aVal);
    });

    appendSectionLabel(tbody, 'PRIMARY');
    for (const row of primaryRows) appendDataRow(tbody, row);

    const sepRow = document.createElement('tr');
    const sepTd = document.createElement('td');
    sepTd.colSpan = data.seasonIds.length + 2;
    sepTd.style.cssText = 'height:1px;padding:0;background:#27272a;';
    sepRow.appendChild(sepTd);
    tbody.appendChild(sepRow);

    appendSectionLabel(tbody, 'SECONDARY');
    for (const row of secondaryRows) appendDataRow(tbody, row);

    table.appendChild(tbody);
    container.appendChild(table);
  }

  function appendSectionLabel(tbody: HTMLElement, label: string): void {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = data.seasonIds.length + 2;
    td.style.cssText = 'font-size:8px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#3f3f46;text-align:right;padding:10px 12px 2px 0;';
    td.textContent = label;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function appendDataRow(tbody: HTMLElement, row: AffixMatrixRow): void {
    const tr = document.createElement('tr');

    const labelTd = document.createElement('td');
    const labelColor = row.isPrimary ? (row.isFortified ? '#3b82f6' : '#f97316') : '#a1a1aa';
    labelTd.style.cssText = `padding:0 12px 0 0;font-size:11px;font-weight:500;text-align:right;white-space:nowrap;vertical-align:middle;color:${labelColor};`;
    labelTd.textContent = row.affixName;
    tr.appendChild(labelTd);

    for (const seasonId of data.seasonIds) {
      const val = row.cells[seasonId] ?? null;
      const st  = cellStyle(val);
      const dim = selectedCol !== 'avg' && selectedCol !== seasonId;
      const td  = document.createElement('td');
      td.style.cssText = `width:58px;height:22px;border-radius:3px;text-align:center;font-size:9.5px;font-weight:700;vertical-align:middle;font-variant-numeric:tabular-nums;background:${st.bg};color:${st.text};opacity:${dim ? '0.25' : '1'};transition:opacity 0.18s;`;
      td.textContent = fmt(val);
      td.title = `${row.affixName} · S${seasonId}: ${fmt(val)}`;
      tr.appendChild(td);
    }

    const avgSt  = cellStyle(row.avgDelta);
    const avgDim = selectedCol !== 'avg';
    const avgTd  = document.createElement('td');
    avgTd.style.cssText = `width:58px;height:22px;border-radius:3px;text-align:center;font-size:10.5px;font-weight:800;vertical-align:middle;font-variant-numeric:tabular-nums;border-left:2px solid #27272a;background:${avgSt.bg};color:${avgSt.text};opacity:${avgDim ? '0.25' : '1'};transition:opacity 0.18s;`;
    avgTd.textContent = fmt(row.avgDelta);
    avgTd.title = `${row.affixName} · Average: ${fmt(row.avgDelta)}`;
    tr.appendChild(avgTd);

    tbody.appendChild(tr);
  }

  render();
}
```

- [ ] **Step 4: Run tests — expect all to pass**

```bash
npm run test -- --reporter=verbose src/charts/affix-matrix.test.ts
```

Expected: 11 tests, all PASS.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/charts/affix-matrix.ts src/charts/affix-matrix.test.ts
git commit -m "✨ Add affix impact matrix renderer with pure function tests"
```

---

## Task 5: Rewrite `affix.ts`

**Files:**
- Modify: `src/charts/affix.ts`

- [ ] **Step 1: Replace the entire contents of `src/charts/affix.ts`**

```typescript
import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import { getPrimaryAffixDeltaBySeason, getSecondaryAffixImpactAllSeasons } from '../db/queries.js';
import { subscribe, setState } from '../state.js';
import { renderAffixMatrix, buildAffixMatrixData } from './affix-matrix.js';
import { MAX_SEASON } from '../config.js';
import type { DungeonManifest } from '../types.js';

export async function initAffixChart(
  conn: AsyncDuckDBConnection,
  manifest: DungeonManifest,
): Promise<void> {
  const container = document.querySelector('#affix') as HTMLElement | null;
  if (!container) return;

  let lastDungeonId: number | null | undefined = undefined;

  subscribe(async state => {
    const dungeonId = state.selectedDungeons.length === 1 ? state.selectedDungeons[0] : null;
    if (dungeonId === lastDungeonId) return;
    lastDungeonId = dungeonId;

    container.innerHTML = '';

    if (dungeonId === null) {
      const msg = state.selectedDungeons.length === 0
        ? 'Select a dungeon to analyze affixes.'
        : 'Select a single dungeon to analyze affixes.';
      container.innerHTML = `<div style="color:#999;text-align:center;padding:20px;">${msg}</div>`;
      return;
    }

    const dungeon = manifest.dungeons.find(d => d.id === dungeonId);
    if (!dungeon) return;

    const availableSeasons = manifest.seasons
      .filter(s => s.dungeonIds.includes(dungeonId) && s.id <= MAX_SEASON)
      .map(s => s.id)
      .sort((a, b) => a - b);

    if (availableSeasons.length === 0) {
      container.innerHTML = '<div style="color:#999;text-align:center;padding:20px;">No pre-S13 season data for this dungeon.</div>';
      return;
    }

    const title = document.createElement('div');
    title.style.cssText = 'padding:16px;font-size:16px;font-weight:bold;color:#e4e4e7;border-bottom:1px solid #27272a;';
    title.textContent = `${dungeon.name} — Affix Impact`;
    container.appendChild(title);

    const matrixContainer = document.createElement('div');
    matrixContainer.style.cssText = 'padding:20px;overflow-x:auto;';
    container.appendChild(matrixContainer);

    try {
      const [primaryDeltas, secondaryData] = await Promise.all([
        getPrimaryAffixDeltaBySeason(conn, dungeonId, availableSeasons),
        getSecondaryAffixImpactAllSeasons(conn, dungeonId, availableSeasons),
      ]);

      const matrixData = buildAffixMatrixData(dungeonId, availableSeasons, primaryDeltas, secondaryData);
      renderAffixMatrix(matrixContainer, matrixData, (seasonId) => {
        setState({ selectedSeasonForArc: seasonId });
      });
    } catch (err) {
      console.error('Affix matrix error:', err);
      matrixContainer.innerHTML = '<div style="color:#ef4444;padding:20px;">Error loading affix data.</div>';
    }
  });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. (The old imports from `affix-stream.js` and `affix-radial.js` are now gone — they will produce errors if still present. If there are errors about unused imports in the old files, proceed to Task 6.)

- [ ] **Step 3: Run full test suite**

```bash
npm run test
```

Expected: all existing tests pass (ranks, seasons, affix-matrix).

- [ ] **Step 4: Commit**

```bash
git add src/charts/affix.ts
git commit -m "♻️ Rewrite affix panel to use unified impact matrix"
```

---

## Task 6: Delete dead files and verify build

**Files:**
- Delete: `src/charts/affix-stream.ts`
- Delete: `src/charts/affix-radial.ts`

- [ ] **Step 1: Confirm nothing else imports the files being deleted**

```bash
grep -r "affix-stream\|affix-radial\|renderStreamGraph\|renderRadialChart\|getAffixColor" src/
```

Expected: no output (only the files themselves would match, and they're being deleted).

- [ ] **Step 2: Delete the files**

```bash
rm src/charts/affix-stream.ts src/charts/affix-radial.ts
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Full build**

```bash
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 5: Smoke test in browser**

```bash
npm run dev
```

Open http://localhost:5173, click any dungeon (single selection), scroll to the affix panel. Verify:
- Matrix appears with PRIMARY (Tyrannical, Fortified) and SECONDARY sections
- Cells show colored values with `+`/`−` sign and 2 decimal places
- Clicking a season column header highlights it and dims the rest
- Clicking AVG returns to default purple highlight
- Hovering a cell shows the browser tooltip with affix name and value

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "🗑️ Remove affix-stream and affix-radial, replaced by matrix"
```
