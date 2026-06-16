import type { SeasonMeta } from '../types.js';

const EXPANSION_NAME_MAP: Record<string, string> = {
  Vanilla: 'Battle for Azeroth',
};

export function expansionName(season: SeasonMeta): string | null {
  const m = season.name.match(/\((.+?) Season \d+\)/);
  if (!m) return null;
  return EXPANSION_NAME_MAP[m[1]] ?? m[1];
}

