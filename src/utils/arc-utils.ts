import type { WeeklyArcRow } from '../types.js';

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

export interface AverageArcPoint {
  period_index: number;
  median_key: number;
}

export function computeAverageArc(seasonRows: WeeklyArcRow[][]): AverageArcPoint[] {
  const byWeek = new Map<number, number[]>();
  for (const rows of seasonRows) {
    for (const row of rows) {
      if (!byWeek.has(row.period_index)) byWeek.set(row.period_index, []);
      byWeek.get(row.period_index)!.push(row.median_key);
    }
  }
  return Array.from(byWeek.entries())
    .map(([period_index, keys]) => ({
      period_index,
      median_key: keys.reduce((a, b) => a + b, 0) / keys.length,
    }))
    .sort((a, b) => a.period_index - b.period_index);
}
