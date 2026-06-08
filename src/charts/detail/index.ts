import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import { setState, subscribe } from '../../state.js';
import { getKeyDistribution } from '../../db/queries.js';
import { ERA_LABELS, ERA_PALETTE } from '../../config.js';
import { renderEraView } from './era.js';
import { renderReintroductionView } from './reintroduction.js';
import type { SeasonSnapshot } from './reintroduction.js';
import type { DungeonManifest, VolumeRow } from '../../types.js';

let allVolume: VolumeRow[] = [];

export function setAllVolume(rows: VolumeRow[]): void {
  allVolume = rows;
}

export function initDetail(
  container: HTMLElement,
  manifest: DungeonManifest,
  conn: AsyncDuckDBConnection,
): void {
  subscribe(async (state) => {
    if (state.selectedDungeon === null) {
      container.classList.remove('open');
      return;
    }

    const dungeon = manifest.dungeons.find(d => d.id === state.selectedDungeon);
    if (!dungeon) return;

    container.classList.add('open');
    container.replaceChildren();

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'padding:16px;border-bottom:1px solid #27272a;display:flex;align-items:flex-start;gap:8px';

    const titleWrap = document.createElement('div');
    titleWrap.style.cssText = 'flex:1;min-width:0';

    const nameEl = document.createElement('h2');
    nameEl.style.cssText = 'margin:0 0 4px;font-size:15px;font-weight:600;color:#f4f4f5';
    nameEl.textContent = dungeon.name;
    titleWrap.appendChild(nameEl);

    const eraBadge = document.createElement('span');
    eraBadge.style.cssText = `font-size:11px;padding:2px 8px;border-radius:10px;background:${ERA_PALETTE[dungeon.era]}33;color:${ERA_PALETTE[dungeon.era]};border:1px solid ${ERA_PALETTE[dungeon.era]}66`;
    eraBadge.textContent = ERA_LABELS[dungeon.era];
    titleWrap.appendChild(eraBadge);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'background:none;border:none;color:#71717a;cursor:pointer;font-size:16px;padding:0;flex-shrink:0';
    closeBtn.addEventListener('click', () => setState({ selectedDungeon: null }));

    header.appendChild(titleWrap);
    header.appendChild(closeBtn);
    container.appendChild(header);

    const body = document.createElement('div');
    container.appendChild(body);

    const { selectedSeason, viewMode } = state;
    if (selectedSeason === -1) return;

    if (viewMode === 'era') {
      const thisVol = allVolume.find(r => r.dungeon_id === dungeon.id);
      renderEraView(body, dungeon, thisVol, allVolume, manifest);
    } else {
      const snapshots: SeasonSnapshot[] = [];
      const alwaysInPool = manifest.seasons.every(s => s.dungeonIds.includes(dungeon.id));
      let isFirst = true;

      for (const season of manifest.seasons.sort((a, b) => a.id - b.id)) {
        if (!season.dungeonIds.includes(dungeon.id)) {
          isFirst = false;
          continue;
        }
        try {
          const dist = await getKeyDistribution(conn, season.id, dungeon.id);
          snapshots.push({
            seasonId: season.id,
            seasonName: season.name,
            isFirstAppearance: isFirst,
            alwaysInPool,
            distribution: dist,
            maxKey: dist.length > 0 ? Math.max(...dist.map(r => r.keystone_level)) : 0,
            entryCount: dist.reduce((s, r) => s + r.count, 0),
          });
          isFirst = false;
        } catch {
          // season parquet may not have loaded
        }
      }

      renderReintroductionView(body, dungeon, snapshots);
    }
  });
}
