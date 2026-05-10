import type { DungeonManifest, VolumeRow } from '../../types';
import { setState, subscribe } from '../../state';
import { ERA_PALETTE, ERA_LABELS } from '../../config';
import { renderEraView } from './era';
import { renderReintroductionView } from './reintroduction';
import type { SeasonSnapshot } from './reintroduction';
import { MOCK_KEY_DIST, MOCK_VOLUME } from '../../mock';

let allVolume: VolumeRow[] = [];

export function initDetail(container: HTMLElement, manifest: DungeonManifest): void {
  const detailEl = document.getElementById('detail')!;

  subscribe(state => {
    const { selectedDungeon, viewMode } = state;
    if (selectedDungeon === null) {
      detailEl.classList.remove('open');
      return;
    }
    const dungeon = manifest.dungeons.find(d => d.id === selectedDungeon);
    if (!dungeon) return;
    detailEl.classList.add('open');

    while (container.firstChild) container.removeChild(container.firstChild);

    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      borderBottom: '1px solid #27272a',
      gap: '8px',
    });

    const nameWrap = document.createElement('div');
    Object.assign(nameWrap.style, { display: 'flex', alignItems: 'center', gap: '8px', minWidth: '0' });

    const dot = document.createElement('span');
    Object.assign(dot.style, {
      width: '10px', height: '10px', borderRadius: '50%',
      background: ERA_PALETTE[dungeon.era], flexShrink: '0', display: 'inline-block',
    });

    const nameEl = document.createElement('span');
    nameEl.textContent = dungeon.name;
    Object.assign(nameEl.style, {
      fontWeight: '600', fontSize: '14px',
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    });

    const badge = document.createElement('span');
    badge.textContent = ERA_LABELS[dungeon.era];
    Object.assign(badge.style, {
      fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
      background: `${ERA_PALETTE[dungeon.era]}33`, color: ERA_PALETTE[dungeon.era], flexShrink: '0',
    });

    nameWrap.appendChild(dot);
    nameWrap.appendChild(nameEl);
    nameWrap.appendChild(badge);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    Object.assign(closeBtn.style, {
      background: 'transparent', border: 'none', color: '#71717a',
      fontSize: '16px', cursor: 'pointer', padding: '0 4px', flexShrink: '0',
    });
    closeBtn.addEventListener('click', () => setState({ selectedDungeon: null }));

    header.appendChild(nameWrap);
    header.appendChild(closeBtn);
    container.appendChild(header);

    const toggle = document.createElement('div');
    Object.assign(toggle.style, {
      display: 'flex', gap: '4px', padding: '10px 16px', borderBottom: '1px solid #27272a',
    });

    (['era', 'reintroduction'] as const).forEach(mode => {
      const btn = document.createElement('button');
      btn.textContent = mode === 'era' ? 'Era View' : 'Reintroduction';
      Object.assign(btn.style, {
        flex: '1', padding: '4px 8px', borderRadius: '4px',
        border: '1px solid #3f3f46', fontSize: '12px', cursor: 'pointer',
        background: viewMode === mode ? '#27272a' : 'transparent',
        color: viewMode === mode ? '#e4e4e7' : '#71717a',
      });
      btn.addEventListener('click', () => setState({ viewMode: mode }));
      toggle.appendChild(btn);
    });

    container.appendChild(toggle);

    const chartArea = document.createElement('div');
    chartArea.style.padding = '16px 0';
    container.appendChild(chartArea);

    const volRow = allVolume.find(r => r.dungeon_id === dungeon.id);

    if (viewMode === 'era') {
      renderEraView(chartArea, dungeon, volRow, allVolume, manifest);
    } else {
      renderReintroductionView(chartArea, dungeon, buildSnapshots(dungeon.id, manifest));
    }
  });
}

export function setAllVolume(rows: VolumeRow[]): void {
  allVolume = rows;
}

function buildSnapshots(dungeonId: number, manifest: DungeonManifest): SeasonSnapshot[] {
  const seasons = manifest.seasons
    .filter(s => s.dungeonIds.includes(dungeonId))
    .sort((a, b) => a.id - b.id);

  const alwaysInPool = seasons.length === manifest.seasons.length;

  return seasons.map((season, idx) => {
    const dist = MOCK_KEY_DIST[season.id]?.[dungeonId] ?? [];
    const vol = MOCK_VOLUME[season.id]?.find(r => r.dungeon_id === dungeonId);
    return {
      seasonId: season.id,
      seasonName: season.name,
      isFirstAppearance: idx === 0,
      alwaysInPool,
      distribution: dist,
      maxKey: vol?.max_key ?? 0,
      entryCount: vol?.entry_count ?? 0,
    };
  });
}
