import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import { ERA_PALETTE, ERA_LABELS, ERAS_IN_ORDER } from '../config.js';
import { getSeasonRankMatrix } from '../db/queries.js';
import { loadSeason } from '../db/init.js';
import { computeRanks } from '../utils/ranks.js';
import { expansionName, seasonLabel } from '../utils/seasons.js';
import { setState, subscribe } from '../state.js';
import type { DungeonManifest, RankMatrixRow, SeasonMeta } from '../types.js';

export async function initDungeonBrowser(
  container: HTMLElement,
  manifest: DungeonManifest,
  conn: AsyncDuckDBConnection,
): Promise<void> {
  const seasons = manifest.seasons
    .filter((s) => s.dungeonIds.length > 0)
    .sort((a, b) => a.id - b.id);

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
      lane.className = 'lane';
      lane.dataset.seasonId = String(season.id);

      const labelEl = document.createElement('div');
      labelEl.className = 'lane-label';
      labelEl.textContent = seasonLabel(season);
      lane.appendChild(labelEl);

      const tilesEl = document.createElement('div');
      tilesEl.className = 'lane-tiles';

      for (const r of entries) {
        const dungeon = manifest.dungeons.find((d) => d.id === r.dungeon_id);
        if (!dungeon) continue;

        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.dataset.dungeonId = String(dungeon.id);
        tile.style.background = ERA_PALETTE[dungeon.era];
        tile.textContent = dungeon.abbrev;

        const tooltip = document.createElement('div');
        tooltip.className = 'tile-tooltip';
        const nameStrong = document.createElement('strong');
        nameStrong.textContent = dungeon.name;
        tooltip.appendChild(nameStrong);
        tooltip.appendChild(document.createElement('br'));
        tooltip.appendChild(document.createTextNode(`${expansion} · ${seasonLabel(season)}`));
        tooltip.appendChild(document.createElement('br'));
        tooltip.appendChild(document.createTextNode(`Median key: +${r.median_key.toFixed(1)}`));
        tooltip.appendChild(document.createElement('br'));
        tooltip.appendChild(document.createTextNode(`Rank ${r.rank} of ${r.total}`));
        tile.appendChild(tooltip);

        tile.addEventListener('mouseenter', () => applyHighlight(dungeon.id));
        tile.addEventListener('mouseleave', clearHighlight);
        tile.addEventListener('click', () =>
          setState({ selectedDungeon: dungeon.id, selectedSeasonForArc: season.id }),
        );

        tilesEl.appendChild(tile);
      }

      lane.appendChild(tilesEl);
      lanesEl.appendChild(lane);
    }
  }

  // Era legend (only eras present in the manifest, in canonical order)
  const usedEras = ERAS_IN_ORDER.filter((era) =>
    manifest.dungeons.some((d) => d.era === era),
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

  // Keep .tile--selected in sync with global state (e.g. arc legend clicks)
  subscribe((state) => {
    container.querySelectorAll<HTMLElement>('.tile').forEach((tile) => {
      tile.classList.toggle(
        'tile--selected',
        state.selectedDungeon !== null &&
          Number(tile.dataset.dungeonId) === state.selectedDungeon,
      );
    });
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
