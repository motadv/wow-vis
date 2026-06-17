import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import { getWeeklyArc, getSecondaryAffixImpact } from "../db/queries.js";
import { loadSeason } from "../db/init.js";
import { getState, subscribe } from "../state.js";
import { FONT } from "../theme.js";
import { computeSharedSeasons } from "../utils/arc-utils.js";
import { MAX_SEASON, DISABLED_SEASONS } from "../config.js";
import type { DungeonManifest, DungeonMeta } from "../types.js";
import { type ArcEntry, setKeyDomain } from "./arc-shared.js";
import { renderArc } from "./arc-single.js";
import { renderMultiArc } from "./arc-multi.js";

export { setKeyDomain };

export function initArc(
  container: HTMLElement,
  manifest: DungeonManifest,
  conn: AsyncDuckDBConnection,
): void {
  const emptyMsg = document.createElement("p");
  emptyMsg.style.cssText = `margin:0;padding:16px;font-size:${FONT.small}px;color:#71717a;text-align:center`;
  emptyMsg.textContent =
    "Select a dungeon on the map or heatmap to see its weekly progression.";
  container.appendChild(emptyMsg);

  let lastSelectionKey = "";
  let lastSingleData: ArcEntry[] = [];
  let lastMultiData = new Map<number, ArcEntry[]>();
  let comparisonSeasonId: number | null = null;
  const affixImpactCache = new Map<string, Map<number, { affixName: string; impactDelta: number }>>();

  const onSelectSeason = async (seasonId: number | null): Promise<void> => {
    comparisonSeasonId = seasonId;

    if (seasonId !== null) {
      const dungeonIds = getState().selectedDungeons;
      await Promise.all(
        dungeonIds.map(async (dungeonId) => {
          const cacheKey = `${dungeonId}:${seasonId}`;
          if (!affixImpactCache.has(cacheKey)) {
            const impacts = await getSecondaryAffixImpact(conn, dungeonId, seasonId);
            affixImpactCache.set(
              cacheKey,
              new Map(impacts.map(i => [i.affixId, { affixName: i.affixName, impactDelta: i.impactDelta }])),
            );
          }
        }),
      );
    }

    const currentState = getState();
    const selectedDungeons = currentState.selectedDungeons
      .map(id => manifest.dungeons.find(d => d.id === id))
      .filter((d): d is DungeonMeta => d !== undefined);
    const sharedSeasons = computeSharedSeasons(
      manifest.seasons,
      currentState.selectedDungeons,
      DISABLED_SEASONS,
      MAX_SEASON,
    );
    renderMultiArc(container, selectedDungeons, lastMultiData, sharedSeasons, comparisonSeasonId, onSelectSeason, affixImpactCache);
  };

  subscribe(async (state) => {
    if (state.selectedDungeons.length === 0) {
      lastSelectionKey = "";
      lastSingleData = [];
      container.replaceChildren(emptyMsg);
      return;
    }

    if (state.selectedDungeons.length > 1) {
      const selectionKey = [...state.selectedDungeons].sort().join(",");

      if (selectionKey !== lastSelectionKey) {
        comparisonSeasonId = null;
        const newMultiData = new Map<number, ArcEntry[]>();

        for (const dungeonId of state.selectedDungeons) {
          if (lastMultiData.has(dungeonId)) {
            newMultiData.set(dungeonId, lastMultiData.get(dungeonId)!);
            continue;
          }
          const activeSeasons = manifest.seasons
            .filter(
              (s) => s.dungeonIds.includes(dungeonId) && s.id <= MAX_SEASON && !DISABLED_SEASONS.has(s.id),
            )
            .sort((a, b) => a.id - b.id);

          const entries = await Promise.all(
            activeSeasons.map(async (s, i) => {
              await loadSeason(s.id);
              const rows = await getWeeklyArc(conn, dungeonId, s.id);
              return {
                season: s,
                rows,
                colorIndex: i,
                secondaryAffixImpact: new Map<number, number>(),
              };
            }),
          );
          newMultiData.set(dungeonId, entries);
        }

        const currentKey = [...getState().selectedDungeons].sort().join(",");
        if (currentKey !== selectionKey) return;

        lastSelectionKey = selectionKey;
        lastMultiData = newMultiData;
        lastSingleData = [];
      }

      const selectedDungeons = state.selectedDungeons
        .map((id) => manifest.dungeons.find((d) => d.id === id))
        .filter((d): d is DungeonMeta => d !== undefined);

      const sharedSeasons = computeSharedSeasons(
        manifest.seasons,
        state.selectedDungeons,
        DISABLED_SEASONS,
        MAX_SEASON,
      );
      renderMultiArc(container, selectedDungeons, lastMultiData, sharedSeasons, comparisonSeasonId, onSelectSeason, affixImpactCache);
      return;
    }

    // single dungeon mode
    const dungeonId = state.selectedDungeons[0];
    const selectionKey = String(dungeonId);

    if (selectionKey !== lastSelectionKey) {
      const activeSeasonsForDungeon = manifest.seasons
        .filter((s) => s.dungeonIds.includes(dungeonId) && s.id <= MAX_SEASON && !DISABLED_SEASONS.has(s.id))
        .sort((a, b) => a.id - b.id);

      lastSingleData = await Promise.all(
        activeSeasonsForDungeon.map(async (s, i) => {
          await loadSeason(s.id);
          const [rows, affixImpacts] = await Promise.all([
            getWeeklyArc(conn, dungeonId, s.id),
            getSecondaryAffixImpact(conn, dungeonId, s.id),
          ]);
          const secondaryAffixImpact = new Map(
            affixImpacts.map((a) => [a.affixId, a.impactDelta]),
          );
          return { season: s, rows, colorIndex: i, secondaryAffixImpact };
        }),
      );

      const currentAfterFetch = getState().selectedDungeons;
      if (currentAfterFetch.length !== 1 || currentAfterFetch[0] !== dungeonId) return;
      lastSelectionKey = selectionKey;
      lastMultiData.clear();
    }

    const dungeon = manifest.dungeons.find((d) => d.id === dungeonId);
    if (!dungeon) return;

    renderArc(container, dungeon.name, lastSingleData, state.selectedSeasonForArc);
  });
}
