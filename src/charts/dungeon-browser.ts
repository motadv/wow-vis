import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import { ERA_PALETTE, ERA_LABELS, ERAS_IN_ORDER, MAX_SEASON, DISABLED_SEASONS } from '../config.js';
import { getSeasonRankMatrix } from '../db/queries.js';
import { loadSeason } from '../db/init.js';
import { expansionName } from '../utils/seasons.js';
import { subscribe, getState, toggleDungeonSelection } from '../state.js';
import type { DungeonManifest, RankMatrixRow, SeasonMeta } from '../types.js';

export function matchesDungeonSearch(name: string, query: string): boolean {
  return name.toLowerCase().includes(query.toLowerCase());
}

export interface RankedMatrixRow extends RankMatrixRow {
  rank: number;
  total: number;
}

export function computeRanks(rows: RankMatrixRow[]): RankedMatrixRow[] {
  const bySeason = new Map<number, RankMatrixRow[]>();
  for (const row of rows) {
    const arr = bySeason.get(row.season_id) ?? [];
    arr.push(row);
    bySeason.set(row.season_id, arr);
  }

  const result: RankedMatrixRow[] = [];
  for (const seasonRows of bySeason.values()) {
    const sorted = [...seasonRows].sort((a, b) => b.median_key - a.median_key);
    const total = sorted.length;
    sorted.forEach((row, i) => result.push({ ...row, rank: i + 1, total }));
  }
  return result;
}

function handleTileClick(dungeonId: number, event: MouseEvent): void {
  event.stopPropagation();
  toggleDungeonSelection(dungeonId);
}

export async function initDungeonBrowser(
  container: HTMLElement,
  manifest: DungeonManifest,
  conn: AsyncDuckDBConnection,
): Promise<void> {
  const seasons = manifest.seasons
    .filter((s) => s.dungeonIds.length > 0 && s.id <= MAX_SEASON)
    .sort((a, b) => a.id - b.id);

  const validDungeonIds = new Set(seasons.flatMap(s => s.dungeonIds));
  const dungeons = manifest.dungeons.filter(d => validDungeonIds.has(d.id));

  container.textContent = 'Loading…';
  await Promise.all(seasons.map((s) => loadSeason(s.id)));

  const rawRows: RankMatrixRow[] = [];
  for (const s of seasons) {
    const rows = await getSeasonRankMatrix(conn, s.id);
    rawRows.push(...rows);
  }

  const ranked = computeRanks(rawRows);

  // Per-season sorted list: rank 1 (best) first → leftmost tile
  const bySeason = new Map<number, typeof ranked>();
  for (const season of seasons) {
    bySeason.set(
      season.id,
      ranked.filter((r) => r.season_id === season.id).sort((a, b) => a.rank - b.rank),
    );
  }

  container.textContent = '';

  const titleEl = document.createElement('div');
  titleEl.className = 'dungeon-browser-title';
  titleEl.textContent = 'Dungeon Rankings by Season';
  container.appendChild(titleEl);

  const subtitleEl = document.createElement('div');
  subtitleEl.className = 'dungeon-browser-subtitle';
  subtitleEl.textContent = 'Oldest season at top · Left tile = highest median key level';
  container.appendChild(subtitleEl);

  const searchEl = document.createElement('input');
  searchEl.type = 'search';
  searchEl.placeholder = 'Search dungeons…';
  searchEl.className = 'dungeon-browser-search';
  searchEl.addEventListener('input', () => {
    searchQuery = searchEl.value.trim();
    container.classList.toggle('dungeon-browser--searching', searchQuery.length > 0);
    applyTileClasses();
  });
  container.appendChild(searchEl);

  const lanesEl = document.createElement('div');
  lanesEl.className = 'dungeon-browser-lanes';
  container.appendChild(lanesEl);

  const grouped = new Map<string, SeasonMeta[]>();
  for (const season of seasons) {
    const exp = expansionName(season);
    if (exp === null) continue;
    if (!grouped.has(exp)) grouped.set(exp, []);
    grouped.get(exp)!.push(season);
  }

  let firstGroup = true;
  for (const [expansion, expSeasons] of grouped) {
    const headerEl = document.createElement('div');
    headerEl.className = firstGroup
      ? 'expansion-header expansion-header--first'
      : 'expansion-header';
    headerEl.textContent = expansion;
    lanesEl.appendChild(headerEl);
    firstGroup = false;

    for (const season of expSeasons) {
      const entries = bySeason.get(season.id) ?? [];

      const lane = document.createElement('div');
      const isDisabled = DISABLED_SEASONS.has(season.id);
      lane.className = isDisabled ? 'lane lane--disabled' : 'lane';
      lane.dataset.seasonId = String(season.id);

      const labelEl = document.createElement('div');
      labelEl.className = 'lane-label';
      labelEl.textContent = `S${season.id}`;

      lane.appendChild(labelEl);

      const tilesEl = document.createElement('div');
      tilesEl.className = 'lane-tiles';

      for (const r of entries) {
        const dungeon = dungeons.find((d) => d.id === r.dungeon_id);
        if (!dungeon) continue;

        const tile = document.createElement('div');
        tile.className = isDisabled ? 'tile tile--disabled' : 'tile';
        tile.dataset.dungeonId = String(dungeon.id);
        tile.dataset.dungeonName = dungeon.name;
        tile.style.background = ERA_PALETTE[dungeon.era];
        tile.style.cursor = isDisabled ? 'default' : 'pointer';
        tile.textContent = dungeon.abbrev;

        const tooltip = document.createElement('div');
        tooltip.className = 'tile-tooltip';
        const nameStrong = document.createElement('strong');
        nameStrong.textContent = dungeon.name;
        tooltip.appendChild(nameStrong);
        tooltip.appendChild(document.createElement('br'));
        tooltip.appendChild(document.createTextNode(`${expansion} · S${season.id}`));
        tooltip.appendChild(document.createElement('br'));
        tooltip.appendChild(document.createTextNode(`Median key: +${r.median_key.toFixed(1)}`));
        tooltip.appendChild(document.createElement('br'));
        tooltip.appendChild(document.createTextNode(`Rank ${r.rank} of ${r.total}`));
        tile.appendChild(tooltip);

        if (!isDisabled) {
          tile.addEventListener('mouseenter', () => {
            if (searchQuery.length > 0) return;
            applyHighlight(dungeon.id);
            const rect = tile.getBoundingClientRect();
            const tooltipHeight = 100;
            tooltip.classList.toggle('tile-tooltip--below', rect.top < tooltipHeight + 16);
          });
          tile.addEventListener('mouseleave', () => {
            if (searchQuery.length > 0) return;
            clearHighlight();
          });
          tile.onclick = (e) => handleTileClick(dungeon.id, e as MouseEvent);
        }

        tilesEl.appendChild(tile);
      }

      lane.appendChild(tilesEl);
      lanesEl.appendChild(lane);
    }
  }

  // Era legend (only eras present in the manifest, in canonical order)
  const usedEras = ERAS_IN_ORDER.filter((era) =>
    dungeons.some((d) => d.era === era),
  );
  const legendEl = document.createElement('div');
  legendEl.className = 'dungeon-browser-legend';
  for (const era of usedEras) {
    const item = document.createElement('div');
    item.className = 'legend-item';
    const dot = document.createElement('span');
    dot.className = 'legend-dot';
    dot.style.background = ERA_PALETTE[era];
    const label = document.createElement('span');
    label.textContent = ERA_LABELS[era];
    item.appendChild(dot);
    item.appendChild(label);
    legendEl.appendChild(item);
  }
  container.appendChild(legendEl);

  let searchQuery = '';

  applyTileClasses();

  function applyTileClasses(): void {
    const currentState = getState();
    const hasSelection = currentState.selectedDungeons.length > 0;
    const hasSearch = searchQuery.length > 0;

    container.querySelectorAll<HTMLElement>('.tile').forEach((tile) => {
      const dungeonId = Number(tile.dataset.dungeonId);
      const dungeonName = tile.dataset.dungeonName ?? '';
      const isSelected = currentState.selectedDungeons.includes(dungeonId);
      const isSearchMatch = hasSearch && matchesDungeonSearch(dungeonName, searchQuery);

      tile.classList.toggle('tile--selected', isSelected);
      tile.classList.toggle('tile--highlighted', !isSelected && isSearchMatch);
      tile.classList.toggle('tile--faded', !isSelected && ((hasSearch && !isSearchMatch) || (!hasSearch && hasSelection)));
    });
  }

  // Keep tile classes in sync with global state and update counter
  subscribe((state) => {
    const hasSelection = state.selectedDungeons.length > 0;

    subtitleEl.textContent = hasSelection
      ? `${state.selectedDungeons.length} / 4 selected · Left tile = highest median key level`
      : 'Oldest season at top · Left tile = highest median key level';

    applyTileClasses();
  });

  function applyHighlight(dungeonId: number): void {
    container.querySelectorAll<HTMLElement>('.lane').forEach((lane) => {
      const hasDungeon = lane.querySelector(`[data-dungeon-id="${dungeonId}"]`) !== null;
      lane.classList.toggle('lane--faded', !hasDungeon);
    });
    container.querySelectorAll<HTMLElement>('.tile').forEach((tile) => {
      tile.classList.toggle('tile--highlighted', Number(tile.dataset.dungeonId) === dungeonId);
    });
  }

  function clearHighlight(): void {
    container.querySelectorAll('.lane').forEach((l) => l.classList.remove('lane--faded'));
    container.querySelectorAll('.tile').forEach((t) => t.classList.remove('tile--highlighted'));
  }

}
