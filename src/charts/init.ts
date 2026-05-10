import { MOCK_MANIFEST, MOCK_VOLUME } from '../mock';
import { setState, subscribe } from '../state';
import { initMap, updateVolume } from './map';
import { initScrubber } from './scrubber';
import { initDetail, setAllVolume } from './detail/index';

export default async function initViz(): Promise<void> {
  const manifest = MOCK_MANIFEST;
  const firstSeason = manifest.seasons[0];

  initMap(document.getElementById('map')!, manifest);
  initScrubber(document.getElementById('scrubber')!, manifest.seasons);
  initDetail(document.getElementById('detail')!, manifest);

  subscribe(({ selectedSeason }) => {
    const rows = MOCK_VOLUME[selectedSeason] ?? [];
    setAllVolume(rows);
    updateVolume(rows);
  });

  setState({ selectedSeason: firstSeason.id });
}
