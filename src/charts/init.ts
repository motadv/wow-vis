import { initDB, loadSeason, getConnection } from '../db/init.js';
import { getVolumeRows } from '../db/queries.js';
import { setState, subscribe } from '../state.js';
import { initMap, updateVolume } from './map.js';
import { initScrubber } from './scrubber.js';
import { initFilters } from './filters.js';
import { initDetail, setAllVolume } from './detail/index.js';
import type { DungeonManifest } from '../types.js';

export default async function initViz(): Promise<void> {
  await initDB();

  const response = await fetch('/data/dungeons.json');
  const manifest: DungeonManifest = await response.json();

  const completedSeasons = manifest.seasons.filter(s => s.dungeonIds.length > 0);
  if (completedSeasons.length === 0) return;

  const firstSeason = completedSeasons[0];

  await loadSeason(firstSeason.id);

  const conn = getConnection();

  initMap(document.getElementById('map')!, manifest);
  initScrubber(document.getElementById('scrubber')!, completedSeasons);
  initFilters(document.getElementById('filters')!);
  initDetail(document.getElementById('detail')!, manifest, conn);

  subscribe(async (state) => {
    if (state.selectedSeason === -1) return;
    await loadSeason(state.selectedSeason);
    const rows = await getVolumeRows(conn, state.selectedSeason);
    setAllVolume(rows);
    updateVolume(rows);
  });

  setState({ selectedSeason: firstSeason.id });
}
