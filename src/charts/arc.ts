import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import { getWeeklyArc, getWeeklyArcAllDungeons, getSecondaryAffixImpact } from "../db/queries.js";
import { loadSeason } from "../db/init.js";
import { getState, subscribe } from "../state.js";
import { computeSharedSeasons } from "../utils/arc-utils.js";
import { MAX_SEASON, DISABLED_SEASONS } from "../config.js";
import type { DungeonManifest, DungeonMeta } from "../types.js";
import { type ArcEntry, setKeyDomain } from "./arc-shared.js";
import { renderArc } from "./arc-single.js";
import { renderMultiArc } from "./arc-multi.js";

export { setKeyDomain };

export async function initArc(
  container: HTMLElement,
  manifest: DungeonManifest,
  conn: AsyncDuckDBConnection,
): Promise<void> {
  // lastSelectionKey memoiza o estado de seleção: se a chave não mudou,
  // evita re-fetch e re-render desnecessários (§4.3 do relatório).
  let lastSelectionKey = "";
  let lastSingleData: ArcEntry[] = [];
  let lastMultiData = new Map<number, ArcEntry[]>();
  // comparisonSeasonId controla qual season está em destaque no modo multi dungeon.
  // É local ao Arc Chart e não entra no estado global porque é uma interação interna.
  let comparisonSeasonId: number | null = null;
  // Cache de impacto de afixos secundários por (dungeonId:seasonId) para evitar
  // recalcular ao trocar de season no modo comparação.
  const affixImpactCache = new Map<string, Map<number, { affixName: string; impactDelta: number }>>();
  // Cache do estado "sem dungeon selecionada" — evita recarregar todas as seasons
  // ao deselecionar uma dungeon (§4.2 do relatório).
  let aggregateArcData: ArcEntry[] | null = null;

  // Callback chamado quando o usuário seleciona uma season nos chips do modo multi.
  // Pré-carrega o impacto de afixos antes de renderizar para que a tooltip já tenha
  // as cores corretas ao exibir a view de comparação.
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

  const render = async (state: import("../types.js").AppState): Promise<void> => {
    // Modo agregado: nenhuma dungeon selecionada — exibe média de todas as dungeons.
    if (state.selectedDungeons.length === 0) {
      lastSelectionKey = "";
      lastSingleData = [];
      lastMultiData.clear();

      if (aggregateArcData === null) {
        const allSeasons = manifest.seasons
          .filter((s) => s.id <= MAX_SEASON && !DISABLED_SEASONS.has(s.id))
          .sort((a, b) => a.id - b.id);

        const entries = await Promise.all(
          allSeasons.map(async (s, i) => {
            await loadSeason(s.id);
            const rows = await getWeeklyArcAllDungeons(conn, s.id);
            return { season: s, rows, colorIndex: i, secondaryAffixImpact: new Map<number, number>() };
          }),
        );

        // Guarda de concorrência: descarta resultado se a seleção mudou durante o fetch.
        if (getState().selectedDungeons.length !== 0) return;
        aggregateArcData = entries;
      }

      // showAffixes=false no modo agregado pois secondaryAffixImpact não é calculado aqui.
      renderArc(container, "All Dungeons", aggregateArcData, state.selectedSeasonForArc, false);
      return;
    }

    // Modo multi dungeon: reutiliza dados já carregados para dungeons que já estavam
    // na seleção anterior, carregando apenas as novas (§4.3 do relatório).
    if (state.selectedDungeons.length > 1) {
      const selectionKey = [...state.selectedDungeons].sort().join(",");

      if (selectionKey !== lastSelectionKey) {
        comparisonSeasonId = null;
        const newMultiData = new Map<number, ArcEntry[]>();

        for (const dungeonId of state.selectedDungeons) {
          // Reutiliza dados existentes para dungeons já carregadas.
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
                // Afixos secundários não são pré-calculados no modo multi — carregados
                // sob demanda em onSelectSeason quando o usuário seleciona uma season.
                secondaryAffixImpact: new Map<number, number>(),
              };
            }),
          );
          newMultiData.set(dungeonId, entries);
        }

        // Guarda de concorrência: descarta se a seleção mudou durante o fetch assíncrono.
        const currentKey = [...getState().selectedDungeons].sort().join(",");
        if (currentKey !== selectionKey) return;

        lastSelectionKey = selectionKey;
        lastMultiData = newMultiData;
        lastSingleData = [];
      }

      const selectedDungeons = state.selectedDungeons
        .map((id) => manifest.dungeons.find((d) => d.id === id))
        .filter((d): d is DungeonMeta => d !== undefined);

      // sharedSeasons: seasons em que TODAS as dungeons selecionadas aparecem —
      // usadas para habilitar os chips de comparação por temporada (§3.2 do relatório).
      const sharedSeasons = computeSharedSeasons(
        manifest.seasons,
        state.selectedDungeons,
        DISABLED_SEASONS,
        MAX_SEASON,
      );
      renderMultiArc(container, selectedDungeons, lastMultiData, sharedSeasons, comparisonSeasonId, onSelectSeason, affixImpactCache);
      return;
    }

    // Modo single dungeon: exibe uma linha por season em que a dungeon apareceu (T2).
    const dungeonId = state.selectedDungeons[0];
    const selectionKey = String(dungeonId);

    if (selectionKey !== lastSelectionKey) {
      const activeSeasonsForDungeon = manifest.seasons
        .filter((s) => s.dungeonIds.includes(dungeonId) && s.id <= MAX_SEASON && !DISABLED_SEASONS.has(s.id))
        .sort((a, b) => a.id - b.id);

      // Busca dados semanais e impacto de afixos em paralelo para cada season.
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

      // Guarda de concorrência: se o usuário trocou de dungeon durante o fetch, descarta.
      const currentAfterFetch = getState().selectedDungeons;
      if (currentAfterFetch.length !== 1 || currentAfterFetch[0] !== dungeonId) return;
      lastSelectionKey = selectionKey;
      lastMultiData.clear();
    }

    const dungeon = manifest.dungeons.find((d) => d.id === dungeonId);
    if (!dungeon) return;

    renderArc(container, dungeon.name, lastSingleData, state.selectedSeasonForArc);
  };

  subscribe(render);
  await render(getState());
}
