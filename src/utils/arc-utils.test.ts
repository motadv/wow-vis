import { describe, it, expect } from 'vitest';
import { computeAverageArc } from './arc-utils.js';
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
