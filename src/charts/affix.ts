import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import {
  getPrimaryAffixDeltaBySeason,
  getSecondaryAffixImpactAllSeasons,
} from "../db/queries.js";
import { subscribe, setState, getState } from "../state.js";
import { loadSeason } from "../db/init.js";
import { dungeonColor } from "../utils/colors.js";
import { renderAffixMatrix, buildAffixMatrixData } from "./affix-matrix.js";
import { MAX_SEASON, DISABLED_SEASONS } from "../config.js";
import type { DungeonManifest } from "../types.js";
import { FONT } from "../theme.js";

export async function initAffixChart(
  conn: AsyncDuckDBConnection,
  manifest: DungeonManifest,
): Promise<void> {
  const container = document.querySelector("#affix") as HTMLElement | null;
  if (!container) return;

  // lastSelectionKey memoiza o conjunto de dungeons selecionadas para evitar
  // recalcular a matriz quando apenas selectedSeasonForArc muda (§4.3).
  let lastSelectionKey = "uninitialized";
  let lastSeasonForArc: number | null | undefined = undefined;
  // Cache do estado sem dungeon selecionada — evita reprocessar todas as seasons
  // ao deselecionar uma dungeon (§4.2 do relatório).
  let aggregateAffixCache: import("../types.js").AffixMatrixData | null = null;

  type DungeonEntry = {
    dungeonId: number;
    dungeon: (typeof manifest.dungeons)[number];
    color: string;
    matrixData: import("../types.js").AffixMatrixData | null;
    error: boolean;
  };

  let cachedDungeonEntries: DungeonEntry[] | null = null;
  let cachedGlobalAffixOrder: number[] | undefined = undefined;

  function renderAggregate(seasonForArc: number | null): void {
    if (!aggregateAffixCache) return;
    container!.replaceChildren();

    const block = document.createElement("div");
    const title = document.createElement("div");
    title.style.cssText = `padding:16px;font-size:${FONT.large}px;font-weight:bold;color:#e4e4e7;border-bottom:1px solid #27272a;`;
    title.textContent = "All Dungeons — Affix Impact";
    block.appendChild(title);

    const matrixContainer = document.createElement("div");
    matrixContainer.style.cssText = "padding:12px;overflow-x:auto;";
    block.appendChild(matrixContainer);
    container!.appendChild(block);

    renderAffixMatrix(
      matrixContainer,
      aggregateAffixCache,
      (seasonId) => { setState({ selectedSeasonForArc: seasonId }); },
      undefined,
      seasonForArc ?? "avg",
    );
  }

  function renderDungeonEntries(seasonForArc: number | null): void {
    if (!cachedDungeonEntries) return;
    const entries = cachedDungeonEntries;
    const isMulti = entries.length > 1;

    container!.replaceChildren();
    const rowEl = document.createElement("div");
    if (isMulti) {
      rowEl.style.cssText =
        "display:flex;flex-direction:row;flex-wrap:wrap;gap:16px;padding:8px 0;";
      container!.appendChild(rowEl);
    }

    for (const { dungeon, color, matrixData, error } of entries) {
      const block = document.createElement("div");
      if (isMulti) {
        block.style.cssText =
          "flex-shrink:0;border:1px solid #27272a;border-radius:6px;overflow:hidden;";
      }
      const parent = isMulti ? rowEl : container!;

      const title = document.createElement("div");
      title.style.cssText = `padding:16px;font-size:${FONT.large}px;font-weight:bold;color:${color};border-bottom:1px solid #27272a;`;
      title.textContent = `${dungeon.name} — Affix Impact`;
      block.appendChild(title);

      const matrixContainer = document.createElement("div");
      matrixContainer.style.cssText = "padding:12px;overflow-x:auto;";
      block.appendChild(matrixContainer);
      parent.appendChild(block);

      if (error || !matrixData) {
        const errDiv = document.createElement("div");
        errDiv.style.cssText = "color:#ef4444;padding:12px;";
        errDiv.textContent = "Error loading affix data.";
        matrixContainer.appendChild(errDiv);
        continue;
      }

      renderAffixMatrix(
        matrixContainer,
        matrixData,
        (seasonId) => { setState({ selectedSeasonForArc: seasonId }); },
        cachedGlobalAffixOrder,
        seasonForArc ?? "avg",
      );
    }
  }

  const render = async (state: import("../types.js").AppState) => {
    const selectionKey = [...state.selectedDungeons].sort().join(",");
    const selectionChanged = selectionKey !== lastSelectionKey;
    const seasonChanged = state.selectedSeasonForArc !== lastSeasonForArc;

    if (!selectionChanged && !seasonChanged) return;
    lastSeasonForArc = state.selectedSeasonForArc;

    if (state.selectedDungeons.length === 0) {
      if (selectionChanged) {
        lastSelectionKey = selectionKey;
        cachedDungeonEntries = null;
        cachedGlobalAffixOrder = undefined;
      }

      if (aggregateAffixCache === null) {
        const allSeasons = manifest.seasons
          .filter((s) => s.id <= MAX_SEASON && !DISABLED_SEASONS.has(s.id))
          .map((s) => s.id)
          .sort((a, b) => a - b);

        await Promise.all(allSeasons.map((id) => loadSeason(id)));

        if ([...getState().selectedDungeons].sort().join(",") !== selectionKey) return;

        const [primaryDeltas, secondaryData] = await Promise.all([
          getPrimaryAffixDeltaBySeason(conn, null, allSeasons),
          getSecondaryAffixImpactAllSeasons(conn, null, allSeasons),
        ]);

        aggregateAffixCache = buildAffixMatrixData(null, allSeasons, primaryDeltas, secondaryData);
      }

      renderAggregate(state.selectedSeasonForArc);
      return;
    }

    if (selectionChanged) {
      lastSelectionKey = selectionKey;
      cachedDungeonEntries = null;
      cachedGlobalAffixOrder = undefined;

      const isMulti = state.selectedDungeons.length > 1;
      const entries: DungeonEntry[] = [];

      for (let idx = 0; idx < state.selectedDungeons.length; idx++) {
        const dungeonId = state.selectedDungeons[idx];
        const dungeon = manifest.dungeons.find((d) => d.id === dungeonId);
        if (!dungeon) continue;

        const color = isMulti ? dungeonColor(idx) : "#e4e4e7";

        const availableSeasons = manifest.seasons
          .filter(
            (s) =>
              s.dungeonIds.includes(dungeonId) &&
              s.id <= MAX_SEASON &&
              !DISABLED_SEASONS.has(s.id),
          )
          .map((s) => s.id)
          .sort((a, b) => a - b);

        if (availableSeasons.length === 0) continue;

        await Promise.all(availableSeasons.map((id) => loadSeason(id)));

        try {
          const [primaryDeltas, secondaryData] = await Promise.all([
            getPrimaryAffixDeltaBySeason(conn, dungeonId, availableSeasons),
            getSecondaryAffixImpactAllSeasons(conn, dungeonId, availableSeasons),
          ]);
          entries.push({
            dungeonId,
            dungeon,
            color,
            matrixData: buildAffixMatrixData(
              dungeonId,
              availableSeasons,
              primaryDeltas,
              secondaryData,
            ),
            error: false,
          });
        } catch (err) {
          console.error("Affix matrix error:", err);
          entries.push({ dungeonId, dungeon, color, matrixData: null, error: true });
        }
      }

      if ([...getState().selectedDungeons].sort().join(",") !== selectionKey) return;

      // União de todos os afixos secundários entre as matrizes das dungeons selecionadas.
      // Necessário para que cada dungeon tenha as mesmas linhas no modo multi,
      // permitindo alinhamento visual lado a lado (§3.3 do relatório).
      const allSecondaryAffixes = new Map<number, string>();
      for (const entry of entries) {
        if (!entry.matrixData) continue;
        for (const row of entry.matrixData.rows.filter((r) => !r.isPrimary)) {
          if (!allSecondaryAffixes.has(row.affixId))
            allSecondaryAffixes.set(row.affixId, row.affixName);
        }
      }

      // Afixos ausentes em uma dungeon recebem células nulas — exibidas como "—" no heatmap.
      if (isMulti) {
        for (const entry of entries) {
          if (!entry.matrixData) continue;
          const existingIds = new Set(
            entry.matrixData.rows.filter((r) => !r.isPrimary).map((r) => r.affixId),
          );
          for (const [affixId, affixName] of allSecondaryAffixes) {
            if (existingIds.has(affixId)) continue;
            const nullCells = Object.fromEntries(
              entry.matrixData.seasonIds.map((s) => [s, null]),
            ) as Record<number, number | null>;
            entry.matrixData.rows.push({
              affixId,
              affixName,
              isPrimary: false,
              cells: nullCells,
              avgDelta: null,
            });
          }
        }

        // Ordem global de afixos: magnitude média do impacto entre todas as dungeons.
        // Passada para renderAffixMatrix() via affixOrder para garantir que linhas
        // se alinhem entre os heatmaps lado a lado (§3.3 do relatório).
        const avgByAffix = new Map<number, number[]>();
        for (const entry of entries) {
          if (!entry.matrixData) continue;
          for (const row of entry.matrixData.rows.filter((r) => !r.isPrimary)) {
            if (row.avgDelta === null) continue;
            const vals = avgByAffix.get(row.affixId) ?? [];
            vals.push(Math.abs(row.avgDelta));
            avgByAffix.set(row.affixId, vals);
          }
        }
        const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
        cachedGlobalAffixOrder = [...avgByAffix.entries()]
          .sort((a, b) => mean(b[1]) - mean(a[1]))
          .map(([id]) => id);
      }

      cachedDungeonEntries = entries;
    }

    renderDungeonEntries(state.selectedSeasonForArc);
  };

  subscribe(render);
  await render(getState());
}
