import type { RankMatrixRow } from '../types.js';

export interface RankedMatrixRow extends RankMatrixRow {
  rank: number;   // 1 = highest median key in this season
  total: number;  // number of dungeons active in this season
}

export function computeRanks(rows: RankMatrixRow[]): RankedMatrixRow[] {
  const bySeason = new Map<number, RankMatrixRow[]>();
  for (const row of rows) {
    const arr = bySeason.get(row.season_id) ?? [];
    arr.push(row);
    bySeason.set(row.season_id, arr);
  }

  const result: RankedMatrixRow[] = [];
  for (const seasonRows of bySeason.values()) {
    const sorted = [...seasonRows].sort((a, b) => b.median_key - a.median_key);
    const total = sorted.length;
    sorted.forEach((row, i) => result.push({ ...row, rank: i + 1, total }));
  }
  return result;
}
