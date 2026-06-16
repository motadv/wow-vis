import { describe, it, expect } from 'vitest';
import { computeAverageArc, collectAtWeek } from './arc-utils.js';
import type { WeeklyArcRow } from '../types.js';

describe('computeAverageArc', () => {
  it('returns empty array for empty input', () => {
    expect(computeAverageArc([])).toEqual([]);
  });

  it('returns same rows when only one season', () => {
    const rows: WeeklyArcRow[] = [
      { period_index: 1, period: 100, median_key: 10 },
      { period_index: 2, period: 101, median_key: 12 },
    ];
    const result = computeAverageArc([rows]);
    expect(result).toEqual([
      { period_index: 1, median_key: 10 },
      { period_index: 2, median_key: 12 },
    ]);
  });

  it('averages median_key across seasons at the same period_index', () => {
    const season1: WeeklyArcRow[] = [{ period_index: 1, period: 100, median_key: 10 }];
    const season2: WeeklyArcRow[] = [{ period_index: 1, period: 200, median_key: 20 }];
    const result = computeAverageArc([season1, season2]);
    expect(result).toEqual([{ period_index: 1, median_key: 15 }]);
  });

  it('handles seasons with different lengths — shorter seasons have no data for later weeks', () => {
    const season1: WeeklyArcRow[] = [
      { period_index: 1, period: 100, median_key: 10 },
      { period_index: 2, period: 101, median_key: 20 },
    ];
    const season2: WeeklyArcRow[] = [
      { period_index: 1, period: 200, median_key: 30 },
    ];
    const result = computeAverageArc([season1, season2]);
    expect(result).toEqual([
      { period_index: 1, median_key: 20 },
      { period_index: 2, median_key: 20 },
    ]);
  });

  it('returns results sorted by period_index ascending', () => {
    const rows: WeeklyArcRow[] = [
      { period_index: 3, period: 103, median_key: 15 },
      { period_index: 1, period: 101, median_key: 10 },
      { period_index: 2, period: 102, median_key: 12 },
    ];
    const result = computeAverageArc([rows]);
    expect(result.map(r => r.period_index)).toEqual([1, 2, 3]);
  });
});

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
