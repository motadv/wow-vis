import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import { getPrimaryAffixDeltaBySeason, getSecondaryAffixImpactAllSeasons } from '../db/queries.js';
import { subscribe, setState } from '../state.js';
import { loadSeason } from '../db/init.js';
import { dungeonColor } from '../utils/colors.js';
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

  let lastSelectionKey = '';

  subscribe(async state => {
    const selectionKey = [...state.selectedDungeons].sort().join(',');
    if (selectionKey === lastSelectionKey) return;
    lastSelectionKey = selectionKey;

    container.replaceChildren();

    if (state.selectedDungeons.length === 0) {
      const div = document.createElement('div');
      div.style.cssText = 'color:#999;text-align:center;padding:20px;';
      div.textContent = 'Select a dungeon to analyze affixes.';
      container.appendChild(div);
      return;
    }

    const isMulti = state.selectedDungeons.length > 1;
    const rowEl = document.createElement('div');
    if (isMulti) {
      rowEl.style.cssText = 'display:flex;flex-direction:row;gap:24px;overflow-x:auto;padding:8px 0;';
      container.appendChild(rowEl);
    }

    for (let idx = 0; idx < state.selectedDungeons.length; idx++) {
      const dungeonId = state.selectedDungeons[idx];
      const dungeon = manifest.dungeons.find(d => d.id === dungeonId);
      if (!dungeon) continue;

      const color = isMulti ? dungeonColor(idx) : '#e4e4e7';

      const availableSeasons = manifest.seasons
        .filter(s => s.dungeonIds.includes(dungeonId) && s.id <= MAX_SEASON)
        .map(s => s.id)
        .sort((a, b) => a - b);

      if (availableSeasons.length === 0) continue;

      await Promise.all(availableSeasons.map(id => loadSeason(id)));

      const block = document.createElement('div');
      if (isMulti) {
        block.style.cssText = 'flex-shrink:0;border:1px solid #27272a;border-radius:6px;overflow:hidden;';
      }
      const parent = isMulti ? rowEl : container;

      const title = document.createElement('div');
      title.style.cssText = `padding:16px;font-size:${FONT.large}px;font-weight:bold;color:${color};border-bottom:1px solid #27272a;`;
      title.textContent = `${dungeon.name} — Affix Impact`;
      block.appendChild(title);

      const matrixContainer = document.createElement('div');
      matrixContainer.style.cssText = 'padding:20px;overflow-x:auto;';
      block.appendChild(matrixContainer);
      parent.appendChild(block);

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
    }
  });
}
