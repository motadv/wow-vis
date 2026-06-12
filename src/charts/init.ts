import { initDB, getConnection } from '../db/init.js';
import { initMap } from './map.js';
import { initHeatmap } from './heatmap.js';
import { initArc, setKeyDomain } from './arc.js';
import { getGlobalKeyRange } from '../db/queries.js';
import type { DungeonManifest } from '../types.js';

export default async function initViz(): Promise<void> {
  await initDB();

  const response = await fetch('/data/dungeons.json');
  const manifest: DungeonManifest = await response.json();

  const conn = getConnection();

  initMap(document.getElementById('map')!, manifest);
  initArc(document.getElementById('arc')!, manifest, conn);
  await initHeatmap(document.getElementById('heatmap')!, manifest, conn);

  const seasonIds = manifest.seasons.filter(s => s.dungeonIds.length > 0).map(s => s.id);
  const { minKey, maxKey } = await getGlobalKeyRange(conn, seasonIds);
  setKeyDomain(Math.floor(minKey) - 3, Math.ceil(maxKey) + 3);
}
