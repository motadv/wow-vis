import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import { getSecondaryAffixImpact, getAggregateSecondaryAffixImpact, getPrimaryAffixTrend } from '../db/queries.js';
import { subscribe, setState } from '../state.js';
import { renderStreamGraph } from './affix-stream.js';
import { renderRadialChart } from './affix-radial.js';
import { MAX_SEASON } from '../config.js';
import type { DungeonManifest, SecondaryAffixImpact } from '../types.js';

function getAvailableSeasonsForDungeons(manifest: DungeonManifest, dungeonIds: number[]): number[] {
  const seasonsSet = new Set<number>();
  for (const season of manifest.seasons) {
    const hasAllDungeons = dungeonIds.every(dId => season.dungeonIds.includes(dId));
    if (hasAllDungeons) {
      seasonsSet.add(season.id);
    }
  }
  return Array.from(seasonsSet).sort((a, b) => b - a);
}

function renderSeasonSelector(container: HTMLElement, availableSeasons: number[], selectedSeasonId: number | null, onSelect: (seasonId: number | null) => void): void {
  const selectorDiv = document.createElement('div');
  selectorDiv.style.cssText = 'padding:12px 16px;border-bottom:1px solid #27272a;display:flex;align-items:center;gap:8px;flex-wrap:wrap;';

  const label = document.createElement('span');
  label.style.cssText = 'font-size:12px;color:#999;text-transform:uppercase;font-weight:600;letter-spacing:0.5px;';
  label.textContent = 'Season:';
  selectorDiv.appendChild(label);

  const buttonGroup = document.createElement('div');
  buttonGroup.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';

  // "All" button
  const allBtn = document.createElement('button');
  allBtn.textContent = 'All';
  allBtn.style.cssText = `
    padding:6px 12px;
    font-size:12px;
    border:1px solid ${selectedSeasonId === null ? '#8b5cf6' : '#404040'};
    background:${selectedSeasonId === null ? '#6d28d9' : 'transparent'};
    color:${selectedSeasonId === null ? '#fff' : '#999'};
    border-radius:4px;
    cursor:pointer;
    transition:all 0.2s ease;
    font-weight:600;
  `;
  allBtn.onmouseover = () => {
    if (selectedSeasonId !== null) {
      allBtn.style.borderColor = '#666';
      allBtn.style.color = '#ccc';
    }
  };
  allBtn.onmouseout = () => {
    if (selectedSeasonId !== null) {
      allBtn.style.borderColor = '#404040';
      allBtn.style.color = '#999';
    }
  };
  allBtn.onclick = () => {
    onSelect(null);
  };
  buttonGroup.appendChild(allBtn);

  // Season buttons
  for (const seasonId of availableSeasons) {
    const btn = document.createElement('button');
    btn.textContent = `S${seasonId}`;

    if (seasonId > MAX_SEASON) {
      btn.disabled = true;
      btn.title = 'Affix analysis not available for War Within seasons';
      btn.style.cssText = `
        padding:6px 12px;
        font-size:12px;
        border:1px solid #303030;
        background:transparent;
        color:#444;
        border-radius:4px;
        cursor:not-allowed;
        opacity:0.4;
        font-weight:600;
      `;
      buttonGroup.appendChild(btn);
      continue;
    }

    const isSelected = selectedSeasonId === seasonId;
    btn.style.cssText = `
      padding:6px 12px;
      font-size:12px;
      border:1px solid ${isSelected ? '#8b5cf6' : '#404040'};
      background:${isSelected ? '#6d28d9' : 'transparent'};
      color:${isSelected ? '#fff' : '#999'};
      border-radius:4px;
      cursor:pointer;
      transition:all 0.2s ease;
      font-weight:600;
    `;
    btn.onmouseover = () => {
      if (!isSelected) {
        btn.style.borderColor = '#666';
        btn.style.color = '#ccc';
      }
    };
    btn.onmouseout = () => {
      if (!isSelected) {
        btn.style.borderColor = '#404040';
        btn.style.color = '#999';
      }
    };
    btn.onclick = () => {
      onSelect(seasonId);
    };
    buttonGroup.appendChild(btn);
  }

  selectorDiv.appendChild(buttonGroup);
  container.appendChild(selectorDiv);
}

export async function initAffixChart(
  conn: AsyncDuckDBConnection,
  manifest: DungeonManifest,
): Promise<void> {
  const container = document.querySelector('#affix') as HTMLElement | null;
  if (!container) return;

  container.innerHTML = '';

  let lastSelectedDungeons: number[] = [];
  let lastSeasonId: number | null = null;

  subscribe(async state => {
    if (state.selectedDungeons.length === 0) {
      container.innerHTML = '<div style="color:#999;text-align:center;padding:20px;">Select one or more dungeons to analyze affixes.</div>';
      return;
    }

    if (state.selectedDungeons === lastSelectedDungeons && state.selectedSeasonForArc === lastSeasonId) {
      return; // No change
    }

    lastSelectedDungeons = [...state.selectedDungeons];
    lastSeasonId = state.selectedSeasonForArc;

    try {
      const availableSeasons = getAvailableSeasonsForDungeons(manifest, state.selectedDungeons);

      // Determine effective season - use selected if available and pre-S13, otherwise aggregate
      const preS13Seasons = availableSeasons.filter(s => s <= MAX_SEASON);
      let effectiveSeasonId = state.selectedSeasonForArc;
      if (effectiveSeasonId && (!availableSeasons.includes(effectiveSeasonId) || effectiveSeasonId > MAX_SEASON)) {
        effectiveSeasonId = null;
      }
      if (!effectiveSeasonId && preS13Seasons.length > 0) {
        effectiveSeasonId = preS13Seasons[0]; // Default to most recent pre-S13 available
      }

      container.innerHTML = '';
      renderSeasonSelector(container, availableSeasons, state.selectedSeasonForArc, (seasonId) => {
        setState({ selectedSeasonForArc: seasonId });
      });

      if (state.selectedDungeons.length === 1) {
        await renderSingleDungeonView(container as HTMLElement, conn, manifest, state.selectedDungeons[0], effectiveSeasonId, availableSeasons);
      } else {
        await renderMultiDungeonView(container as HTMLElement, conn, manifest, state.selectedDungeons, effectiveSeasonId, availableSeasons);
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
  availableSeasons: number[] = [],
): Promise<void> {
  const dungeon = manifest.dungeons.find(d => d.id === dungeonId);
  if (!dungeon) return;

  const preS13Available = availableSeasons.filter(s => s <= MAX_SEASON);
  const effectiveSeasonId = (seasonId && seasonId <= MAX_SEASON ? seasonId : null) ?? preS13Available[0] ?? 6;

  // Title
  const title = document.createElement('div');
  title.style.cssText = 'padding:16px;font-size:16px;font-weight:bold;color:#e4e4e7;border-bottom:1px solid #27272a;';
  title.textContent = `${dungeon.name} — Affix Impact Analysis (Season ${effectiveSeasonId})`;
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
  availableSeasons: number[] = [],
): Promise<void> {
  const preS13Available = availableSeasons.filter(s => s <= MAX_SEASON);
  const effectiveSeasonId = (seasonId && seasonId <= MAX_SEASON ? seasonId : null) ?? preS13Available[0] ?? 6;
  const dungeonNames = dungeonIds.map(id => manifest.dungeons.find(d => d.id === id)?.name || `Dungeon ${id}`).join(', ');

  // Title
  const title = document.createElement('div');
  title.style.cssText = 'padding:16px;font-size:16px;font-weight:bold;color:#e4e4e7;border-bottom:1px solid #27272a;';
  title.textContent = `${dungeonNames} — Aggregate Affix Analysis (Season ${effectiveSeasonId})`;
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
