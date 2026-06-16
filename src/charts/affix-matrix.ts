import type { AffixMatrixData, AffixMatrixRow } from '../types.js';

export const MAX_DELTA = 1.5;

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
