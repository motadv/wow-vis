import { initDB, getConnection, getAffixManifest } from '../db/init.js';
import { initMap } from './map.js';
import { initDungeonBrowser } from './dungeon-browser.js';
import { initArc, setKeyDomain } from './arc.js';
import { initAffixChart } from './affix.js';
import { getGlobalKeyRange } from '../db/queries.js';
import type { DungeonManifest } from '../types.js';

export default async function initViz(): Promise<void> {
  await initDB();

  const response = await fetch('/data/dungeons.json');
  const manifest: DungeonManifest = await response.json();

  const conn = getConnection();
  const affixManifest = getAffixManifest();

  initMap(document.getElementById('map')!, manifest);
  initArc(document.getElementById('arc')!, manifest, conn);
  await initDungeonBrowser(document.getElementById('heatmap')!, manifest, conn);

  const seasonIds = manifest.seasons.filter(s => s.dungeonIds.length > 0).map(s => s.id);
  const { minKey, maxKey } = await getGlobalKeyRange(conn, seasonIds);
  setKeyDomain(Math.floor(minKey) - 3, Math.ceil(maxKey) + 3);

  const dungeonNames = new Map(manifest.dungeons.map(d => [d.id, d.name]));
  await initAffixChart(conn, affixManifest, dungeonNames, seasonIds);
}
