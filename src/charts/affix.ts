import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import { getSecondaryAffixImpact, getAggregateSecondaryAffixImpact, getPrimaryAffixTrend } from '../db/queries.js';
import { subscribe } from '../state.js';
import { renderStreamGraph } from './affix-stream.js';
import { renderRadialChart } from './affix-radial.js';
import type { DungeonManifest, SecondaryAffixImpact } from '../types.js';

export async function initAffixChart(
  conn: AsyncDuckDBConnection,
  manifest: DungeonManifest,
): Promise<void> {
  const container = document.querySelector('#affix');
  if (!container) return;

  container.innerHTML = '';

  let lastSelectedDungeons: number[] = [];
  let lastSeasonId: number | null = null;

  subscribe(async state => {
    if (state.selectedDungeons.length === 0) {
      container.innerHTML = '<div style="color:#999;text-align:center;padding:20px;">Select one or more dungeons to analyze affixes.</div>';
      return;
    }

    if (state.selectedDungeons === lastSelectedDungeons && state.affixFilters.seasonId === lastSeasonId) {
      return; // No change
    }

    lastSelectedDungeons = [...state.selectedDungeons];
    lastSeasonId = state.affixFilters.seasonId;

    try {
      if (state.selectedDungeons.length === 1) {
        await renderSingleDungeonView(container as HTMLElement, conn, manifest, state.selectedDungeons[0], state.affixFilters.seasonId);
      } else {
        await renderMultiDungeonView(container as HTMLElement, conn, manifest, state.selectedDungeons, state.affixFilters.seasonId);
      }
    } catch (err) {
      console.error('Affix chart error:', err);
      container.innerHTML = '<div style="color:#ef4444;padding:20px;">Error loading affix data.</div>';
    }
  });
}

async function renderSingleDungeonView(
  container: HTMLElement,
  conn: AsyncDuckDBConnection,
  manifest: DungeonManifest,
  dungeonId: number,
  seasonId: number | null,
): Promise<void> {
  const dungeon = manifest.dungeons.find(d => d.id === dungeonId);
  if (!dungeon) return;

  const effectiveSeasonId = seasonId || manifest.seasons[manifest.seasons.length - 1]?.id || 6;

  container.innerHTML = '';

  // Title
  const title = document.createElement('div');
  title.style.cssText = 'padding:16px;font-size:16px;font-weight:bold;color:#e4e4e7;border-bottom:1px solid #27272a;';
  title.innerHTML = `${dungeon.name} — Affix Impact Analysis (Season ${effectiveSeasonId})`;
  container.appendChild(title);

  // Stream graph section
  const streamSection = document.createElement('div');
  streamSection.style.cssText = 'padding:16px;border-bottom:1px solid #27272a;';

  const streamLabel = document.createElement('div');
  streamLabel.style.cssText = 'font-size:12px;color:#999;text-transform:uppercase;margin-bottom:12px;';
  streamLabel.textContent = 'Primary Affix Trend (Fortified vs Tyrannical)';
  streamSection.appendChild(streamLabel);

  const streamChart = document.createElement('div');
  streamChart.style.cssText = 'height:180px;';
  streamSection.appendChild(streamChart);
  container.appendChild(streamSection);

  // Radial section
  const radialSection = document.createElement('div');
  radialSection.style.cssText = 'padding:16px;';

  const radialLabel = document.createElement('div');
  radialLabel.style.cssText = 'font-size:12px;color:#999;text-transform:uppercase;margin-bottom:12px;';
  radialLabel.textContent = 'Secondary Affix Impact';
  radialSection.appendChild(radialLabel);

  const radialChart = document.createElement('div');
  radialChart.style.cssText = 'display:flex;justify-content:center;';
  radialSection.appendChild(radialChart);
  container.appendChild(radialSection);

  // Load data and render
  const [streamData, affixData] = await Promise.all([
    getPrimaryAffixTrend(conn, [dungeonId], effectiveSeasonId),
    getSecondaryAffixImpact(conn, dungeonId, effectiveSeasonId),
  ]);

  renderStreamGraph(streamChart, streamData, streamChart.clientWidth, 180);
  renderRadialChart(radialChart, affixData, 250);
}

async function renderMultiDungeonView(
  container: HTMLElement,
  conn: AsyncDuckDBConnection,
  manifest: DungeonManifest,
  dungeonIds: number[],
  seasonId: number | null,
): Promise<void> {
  const effectiveSeasonId = seasonId || manifest.seasons[manifest.seasons.length - 1]?.id || 6;
  const dungeonNames = dungeonIds.map(id => manifest.dungeons.find(d => d.id === id)?.name || `Dungeon ${id}`).join(', ');

  container.innerHTML = '';

  // Title
  const title = document.createElement('div');
  title.style.cssText = 'padding:16px;font-size:16px;font-weight:bold;color:#e4e4e7;border-bottom:1px solid #27272a;';
  title.innerHTML = `${dungeonNames} — Aggregate Affix Analysis (Season ${effectiveSeasonId})`;
  container.appendChild(title);

  // Stream graph section
  const streamSection = document.createElement('div');
  streamSection.style.cssText = 'padding:16px;border-bottom:1px solid #27272a;';

  const streamLabel = document.createElement('div');
  streamLabel.style.cssText = 'font-size:12px;color:#999;text-transform:uppercase;margin-bottom:12px;';
  streamLabel.textContent = 'Primary Affix Trend';
  streamSection.appendChild(streamLabel);

  const streamChart = document.createElement('div');
  streamChart.style.cssText = 'height:180px;';
  streamSection.appendChild(streamChart);
  container.appendChild(streamSection);

  // Aggregate radial section
  const aggregateSection = document.createElement('div');
  aggregateSection.style.cssText = 'padding:16px;border-bottom:1px solid #27272a;';

  const aggregateLabel = document.createElement('div');
  aggregateLabel.style.cssText = 'font-size:12px;color:#999;text-transform:uppercase;margin-bottom:4px;';
  aggregateLabel.textContent = 'Aggregate Secondary Affix Impact';
  aggregateSection.appendChild(aggregateLabel);

  const aggregateSublabel = document.createElement('div');
  aggregateSublabel.style.cssText = 'font-size:11px;color:#666;margin-bottom:12px;font-style:italic;';
  aggregateSublabel.textContent = '(Average across selected dungeons)';
  aggregateSection.appendChild(aggregateSublabel);

  const aggregateChart = document.createElement('div');
  aggregateChart.style.cssText = 'display:flex;justify-content:center;';
  aggregateSection.appendChild(aggregateChart);
  container.appendChild(aggregateSection);

  // Individual radials section
  const individualsSection = document.createElement('div');
  individualsSection.style.cssText = 'padding:16px;';

  const individualsLabel = document.createElement('div');
  individualsLabel.style.cssText = 'font-size:12px;color:#999;text-transform:uppercase;margin-bottom:12px;';
  individualsLabel.textContent = 'Individual Dungeon Impact';
  individualsSection.appendChild(individualsLabel);

  const individualsGrid = document.createElement('div');
  individualsGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;';
  individualsSection.appendChild(individualsGrid);
  container.appendChild(individualsSection);

  // Load data and render
  const [streamData, aggregateDataRaw, ...individualDataArray] = await Promise.all([
    getPrimaryAffixTrend(conn, dungeonIds, effectiveSeasonId),
    getAggregateSecondaryAffixImpact(conn, dungeonIds, effectiveSeasonId),
    ...dungeonIds.map(dId => getSecondaryAffixImpact(conn, dId, effectiveSeasonId)),
  ]);

  // Transform aggregate data to match SecondaryAffixImpact type
  const aggregateData: SecondaryAffixImpact[] = aggregateDataRaw.map(d => ({
    affixId: d.affixId,
    affixName: d.affixName,
    impactDelta: d.averageImpactDelta,
  }));

  renderStreamGraph(streamChart, streamData, streamChart.clientWidth, 180);
  renderRadialChart(aggregateChart, aggregateData, 220);

  // Render individual radials
  for (let i = 0; i < Math.min(dungeonIds.length, 3); i++) {
    const dungeonId = dungeonIds[i];
    const dungeon = manifest.dungeons.find(d => d.id === dungeonId);
    const individualData = individualDataArray[i];

    const card = document.createElement('div');
    card.style.cssText = 'background:#1a1a2e;padding:12px;border-radius:4px;';

    const cardTitle = document.createElement('div');
    cardTitle.style.cssText = 'font-size:12px;color:#a1a1aa;margin-bottom:8px;font-weight:600;';
    cardTitle.textContent = dungeon?.name || `Dungeon ${dungeonId}`;
    card.appendChild(cardTitle);

    const cardChart = document.createElement('div');
    cardChart.style.cssText = 'display:flex;justify-content:center;';
    card.appendChild(cardChart);

    individualsGrid.appendChild(card);

    renderRadialChart(cardChart, individualData, 160);
  }

  // "View all" link if more than 3
  if (dungeonIds.length > 3) {
    const expandLink = document.createElement('div');
    expandLink.style.cssText = 'grid-column:1/-1;text-align:center;padding:12px;font-size:12px;color:#3b82f6;cursor:pointer;text-decoration:underline;';
    expandLink.textContent = `View all ${dungeonIds.length} dungeons`;
    expandLink.onclick = () => {
      console.log('Expand to full grid');
    };
    individualsGrid.appendChild(expandLink);
  }
}
