import { describe, it, expect } from 'vitest';
import { buildAffixMatrixData } from './affix-matrix.js';

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
