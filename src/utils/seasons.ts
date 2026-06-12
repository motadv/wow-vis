import type { SeasonMeta } from '../types.js';

export function expansionName(season: SeasonMeta): string | null {
  const m = season.name.match(/\((.+?) Season \d+\)/);
  return m ? m[1] : null;
}

export function seasonLabel(season: SeasonMeta): string {
  const m = season.name.match(/Season (\d+)\)/);
  return m ? `Season ${m[1]}` : `S${season.id}`;
}
