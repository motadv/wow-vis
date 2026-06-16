import type { WeeklyArcRow } from '../types.js';

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
