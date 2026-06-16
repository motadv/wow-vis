import { initDB, getConnection } from '../db/init.js';
import { initMap } from './map.js';
import { initDungeonBrowser } from './dungeon-browser.js';
import { initArc, setKeyDomain } from './arc.js';
import { initAffixChart } from './affix.js';
import { getGlobalKeyRange } from '../db/queries.js';
import { MAX_SEASON } from '../config.js';
import type { DungeonManifest } from '../types.js';

export default async function initViz(): Promise<void> {
  await initDB();

  const response = await fetch(`${import.meta.env.BASE_URL}data/dungeons.json`);
  const manifest: DungeonManifest = await response.json();

  const conn = getConnection();

  initMap(document.getElementById('map')!, manifest);
  await initDungeonBrowser(document.getElementById('heatmap')!, manifest, conn);
  initArc(document.getElementById('arc')!, manifest, conn);

  const seasonIds = manifest.seasons
    .filter(s => s.dungeonIds.length > 0 && s.id <= MAX_SEASON)
    .map(s => s.id);
  const { minKey, maxKey } = await getGlobalKeyRange(conn, seasonIds);
  setKeyDomain(Math.floor(minKey) - 3, Math.ceil(maxKey) + 3);

  await initAffixChart(conn, manifest);
}
