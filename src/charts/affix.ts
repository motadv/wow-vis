import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import { getPrimaryAffixDeltaBySeason, getSecondaryAffixImpactAllSeasons } from '../db/queries.js';
import { subscribe, setState } from '../state.js';
import { renderAffixMatrix, buildAffixMatrixData } from './affix-matrix.js';
import { MAX_SEASON } from '../config.js';
import type { DungeonManifest } from '../types.js';
import { FONT } from '../theme.js';

export async function initAffixChart(
  conn: AsyncDuckDBConnection,
  manifest: DungeonManifest,
): Promise<void> {
  const container = document.querySelector('#affix') as HTMLElement | null;
  if (!container) return;

  let lastDungeonId: number | null | undefined = undefined;

  subscribe(async state => {
    const dungeonId = state.selectedDungeons.length === 1 ? state.selectedDungeons[0] : null;
    if (dungeonId === lastDungeonId) return;
    lastDungeonId = dungeonId;

    container.innerHTML = '';

    if (dungeonId === null) {
      const msg = state.selectedDungeons.length === 0
        ? 'Select a dungeon to analyze affixes.'
        : 'Select a single dungeon to analyze affixes.';
      const div = document.createElement('div');
      div.style.cssText = 'color:#999;text-align:center;padding:20px;';
      div.textContent = msg;
      container.appendChild(div);
      return;
    }

    const dungeon = manifest.dungeons.find(d => d.id === dungeonId);
    if (!dungeon) return;

    const availableSeasons = manifest.seasons
      .filter(s => s.dungeonIds.includes(dungeonId) && s.id <= MAX_SEASON)
      .map(s => s.id)
      .sort((a, b) => a - b);

    if (availableSeasons.length === 0) {
      const div = document.createElement('div');
      div.style.cssText = 'color:#999;text-align:center;padding:20px;';
      div.textContent = 'No pre-S13 season data for this dungeon.';
      container.appendChild(div);
      return;
    }

    const title = document.createElement('div');
    title.style.cssText = `padding:16px;font-size:${FONT.large}px;font-weight:bold;color:#e4e4e7;border-bottom:1px solid #27272a;`;
    title.textContent = `${dungeon.name} — Affix Impact`;
    container.appendChild(title);

    const matrixContainer = document.createElement('div');
    matrixContainer.style.cssText = 'padding:20px;overflow-x:auto;';
    container.appendChild(matrixContainer);

    try {
      const [primaryDeltas, secondaryData] = await Promise.all([
        getPrimaryAffixDeltaBySeason(conn, dungeonId, availableSeasons),
        getSecondaryAffixImpactAllSeasons(conn, dungeonId, availableSeasons),
      ]);

      const matrixData = buildAffixMatrixData(dungeonId, availableSeasons, primaryDeltas, secondaryData);
      renderAffixMatrix(matrixContainer, matrixData, (seasonId) => {
        setState({ selectedSeasonForArc: seasonId });
      });
    } catch (err) {
      console.error('Affix matrix error:', err);
      const errDiv = document.createElement('div');
      errDiv.style.cssText = 'color:#ef4444;padding:20px;';
      errDiv.textContent = 'Error loading affix data.';
      matrixContainer.appendChild(errDiv);
    }
  });
}
