import * as d3 from 'd3';
import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import type { AffixManifest } from '../types.js';
import { getState, setState, subscribe } from '../state.js';
import {
  getDungeonAffixTrend,
  getSeasonAffixSnapshot,
  getAffixHeadToHead,
  type AffixTrendRow,
  type AffixSnapshotRow,
  type AffixHeadToHeadRow,
} from '../db/queries.js';

export async function initAffixChart(
  conn: AsyncDuckDBConnection,
  affixManifest: AffixManifest,
  dungeonNames: Map<number, string>,
  seasonIds: number[],
): Promise<void> {
  const container = document.querySelector('#affix');
  if (!container) return;

  container.innerHTML = '';

  // Build lens tabs
  const tabsDiv = document.createElement('div');
  tabsDiv.className = 'affix-tabs';

  const lenses = ['trend', 'snapshot', 'headtohead'] as const;
  const lensLabels = { trend: 'Trend', snapshot: 'Snapshot', headtohead: 'Head-to-Head' };

  for (const lens of lenses) {
    const btn = document.createElement('button');
    btn.className = 'affix-tab';
    btn.textContent = lensLabels[lens];
    btn.onclick = () => {
      setState({
        affixLens: lens,
        affixFilters: { ...getState().affixFilters, secondaryAffixId: null, fortified: null },
      });
    };
    tabsDiv.appendChild(btn);
  }
  container.appendChild(tabsDiv);

  // Build filter controls
  const filtersDiv = document.createElement('div');
  filtersDiv.className = 'affix-filters';

  // Dungeon selector
  const dungeonSelect = document.createElement('select');
  dungeonSelect.className = 'affix-select';
  dungeonSelect.id = 'affix-dungeon-select';
  const dungeonPlaceholder = document.createElement('option');
  dungeonPlaceholder.value = '';
  dungeonPlaceholder.textContent = 'Select dungeon…';
  dungeonSelect.appendChild(dungeonPlaceholder);
  const sortedDungeons = Array.from(dungeonNames.entries())
    .sort((a, b) => a[1].localeCompare(b[1]));
  for (const [dungeonId, name] of sortedDungeons) {
    const opt = document.createElement('option');
    opt.value = String(dungeonId);
    opt.textContent = name;
    dungeonSelect.appendChild(opt);
  }
  dungeonSelect.onchange = (e) => {
    const val = (e.target as HTMLSelectElement).value;
    setState({
      affixFilters: { ...getState().affixFilters, dungeonId: val ? Number(val) : null },
    });
  };
  filtersDiv.appendChild(dungeonSelect);

  // Season selector
  const seasonSelect = document.createElement('select');
  seasonSelect.className = 'affix-select';
  seasonSelect.id = 'affix-season-select';
  const seasonPlaceholder = document.createElement('option');
  seasonPlaceholder.value = '';
  seasonPlaceholder.textContent = 'Current season';
  seasonSelect.appendChild(seasonPlaceholder);
  for (const sid of seasonIds) {
    const opt = document.createElement('option');
    opt.value = String(sid);
    opt.textContent = `Season ${sid}`;
    seasonSelect.appendChild(opt);
  }
  seasonSelect.onchange = (e) => {
    const val = (e.target as HTMLSelectElement).value;
    setState({
      affixFilters: { ...getState().affixFilters, seasonId: val ? Number(val) : null },
    });
  };
  filtersDiv.appendChild(seasonSelect);

  // Fortified toggle (Head-to-Head only)
  const fortToggle = document.createElement('button');
  fortToggle.className = 'affix-toggle';
  fortToggle.id = 'affix-fortified-toggle';
  fortToggle.textContent = 'All';
  let toggleState: null | true | false = null;
  fortToggle.onclick = () => {
    toggleState = toggleState === null ? true : toggleState === true ? false : null;
    fortToggle.textContent = toggleState === null ? 'All' : toggleState ? 'Fortified' : 'Tyrannical';
    setState({
      affixFilters: { ...getState().affixFilters, fortified: toggleState },
    });
  };
  filtersDiv.appendChild(fortToggle);

  container.appendChild(filtersDiv);

  // Chart area
  const chartDiv = document.createElement('div');
  chartDiv.className = 'affix-chart';
  container.appendChild(chartDiv);

  async function updateChart() {
    const state = getState();
    const { affixLens, affixFilters } = state;

    // Update active tab
    const tabs = tabsDiv.querySelectorAll('.affix-tab');
    tabs.forEach((tab, i) => {
      tab.classList.toggle('active', lenses[i] === affixLens);
    });

    // Update filter visibility
    dungeonSelect.hidden = affixLens === 'snapshot';
    seasonSelect.hidden = affixLens === 'trend';
    fortToggle.hidden = affixLens !== 'headtohead';

    // Sync selected dungeon from global state if not set
    if (!affixFilters.dungeonId && state.selectedDungeon) {
      setTimeout(() => {
        setState({
          affixFilters: { ...getState().affixFilters, dungeonId: state.selectedDungeon },
        });
      }, 0);
    }

    // Sync selected season from arc if not set
    const effectiveSeasonId = affixFilters.seasonId ?? state.selectedSeasonForArc;

    try {
      if (affixLens === 'trend') {
        await renderTrend(
          conn,
          affixManifest,
          affixFilters.dungeonId,
          seasonIds,
          affixFilters.secondaryAffixId,
          chartDiv,
        );
      } else if (affixLens === 'snapshot') {
        await renderSnapshot(
          conn,
          affixManifest,
          effectiveSeasonId,
          affixFilters.secondaryAffixId,
          dungeonNames,
          chartDiv,
        );
      } else if (affixLens === 'headtohead') {
        await renderHeadToHead(
          conn,
          affixManifest,
          affixFilters.dungeonId,
          effectiveSeasonId,
          affixFilters.fortified,
          chartDiv,
        );
      }
    } catch (err) {
      console.error('Affix chart error:', err);
    }
  }

  // Initial render
  await updateChart();

  // Subscribe to state changes
  subscribe(updateChart);
}

async function renderTrend(
  conn: AsyncDuckDBConnection,
  affixManifest: AffixManifest,
  dungeonId: number | null,
  seasonIds: number[],
  secondaryAffixId: number | null,
  container: HTMLElement,
): Promise<AffixTrendRow[]> {
  if (!dungeonId) {
    container.innerHTML = '<div class="affix-empty-state">Select a dungeon to see Fortified vs Tyrannical trend across seasons</div>';
    return [];
  }

  let periodIds: number[] | undefined;
  if (secondaryAffixId) {
    periodIds = [];
    for (const seasonId of seasonIds) {
      if (affixManifest[seasonId]) {
        for (const [periodId, affixes] of Object.entries(affixManifest[seasonId])) {
          if (affixes.some(a => a.id === secondaryAffixId)) {
            periodIds.push(Number(periodId));
          }
        }
      }
    }
  }

  const data = await getDungeonAffixTrend(conn, dungeonId, seasonIds, periodIds);

  // Group by season with fortified/tyrannical bars
  const grouped = d3.group(data, d => d.season_id);
  const chartData = Array.from(grouped, ([seasonId, rows]) => ({
    seasonId,
    fortified: rows.find(r => r.fortified)?.median_key ?? 0,
    tyrannical: rows.find(r => !r.fortified)?.median_key ?? 0,
  }));

  renderGroupedBarChart(container, chartData, 'Season', 'season_id', ['fortified', 'tyrannical']);
  return data;
}

async function renderSnapshot(
  conn: AsyncDuckDBConnection,
  affixManifest: AffixManifest,
  seasonId: number | null,
  secondaryAffixId: number | null,
  dungeonNames: Map<number, string>,
  container: HTMLElement,
): Promise<AffixSnapshotRow[]> {
  if (!seasonId) {
    container.innerHTML = '<div class="affix-empty-state">No season selected</div>';
    return [];
  }

  let periodIds: number[] | undefined;
  if (secondaryAffixId && affixManifest[seasonId]) {
    periodIds = [];
    for (const [periodId, affixes] of Object.entries(affixManifest[seasonId])) {
      if (affixes.some(a => a.id === secondaryAffixId)) {
        periodIds.push(Number(periodId));
      }
    }
  }

  const data = await getSeasonAffixSnapshot(conn, seasonId, periodIds);

  // Group by dungeon with fortified/tyrannical bars
  const grouped = d3.group(data, d => d.dungeon_id);
  const chartData = Array.from(grouped, ([dungeonId, rows]) => ({
    dungeonId,
    name: dungeonNames.get(dungeonId) ?? `Dungeon ${dungeonId}`,
    fortified: rows.find(r => r.fortified)?.median_key ?? 0,
    tyrannical: rows.find(r => !r.fortified)?.median_key ?? 0,
  }));

  renderGroupedBarChart(container, chartData, 'Dungeon', 'dungeonId', ['fortified', 'tyrannical']);
  return data;
}

async function renderHeadToHead(
  conn: AsyncDuckDBConnection,
  affixManifest: AffixManifest,
  dungeonId: number | null,
  seasonId: number | null,
  fortified: boolean | null,
  container: HTMLElement,
): Promise<AffixHeadToHeadRow[]> {
  if (!dungeonId || !seasonId) {
    container.innerHTML = '<div class="affix-empty-state">Select a dungeon and season to compare secondary affixes</div>';
    return [];
  }

  if (!affixManifest[seasonId]) {
    container.innerHTML = '<div class="affix-empty-state">No affix data for this season</div>';
    return [];
  }

  // Build periodIdsByAffix map
  const allAffixes = new Map<number, number[]>();
  for (const [periodId, affixes] of Object.entries(affixManifest[seasonId])) {
    const isFortified = affixes.some(a => a.id === 10);
    // Skip this period if fortified filter doesn't match
    if (fortified !== null && isFortified !== fortified) continue;

    for (const affix of affixes) {
      if (!allAffixes.has(affix.id)) allAffixes.set(affix.id, []);
      allAffixes.get(affix.id)!.push(Number(periodId));
    }
  }

  const data = await getAffixHeadToHead(conn, dungeonId, seasonId, allAffixes);

  // Map affix IDs to names
  const affixNameMap = new Map<number, string>();
  for (const affixes of Object.values(affixManifest[seasonId])) {
    for (const affix of affixes) {
      affixNameMap.set(affix.id, affix.name);
    }
  }

  const chartData = data.map(d => ({
    affixId: d.affix_id,
    name: affixNameMap.get(d.affix_id) ?? `Affix ${d.affix_id}`,
    median_key: d.median_key,
  }));

  renderBarChart(container, chartData, 'Affix');
  return data;
}

function renderGroupedBarChart(
  container: HTMLElement,
  data: any[],
  xLabel: string,
  xKey: string,
  categories: string[],
): void {
  const width = container.clientWidth || 600;
  const height = container.clientHeight || 300;
  const margin = { top: 20, right: 20, bottom: 30, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  container.innerHTML = '';

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x0 = d3.scaleBand()
    .domain(data.map(d => String(d[xKey])))
    .range([0, innerWidth])
    .padding(0.2);

  const x1 = d3.scaleBand()
    .domain(categories)
    .range([0, x0.bandwidth()])
    .padding(0.1);

  const y = d3.scaleLinear()
    .domain([0, Math.max(...data.flatMap(d => categories.map(c => d[c] ?? 0)))])
    .range([innerHeight, 0]);

  const color = d3.scaleOrdinal()
    .domain(categories)
    .range(['#1f77b4', '#ff7f0e']);

  // Draw bars
  svg.selectAll('g.category')
    .data(categories)
    .join('g')
    .attr('class', 'category')
    .attr('fill', d => color(d) as string)
    .selectAll('rect')
    .data(cat => data.map(d => ({ ...d, category: cat })))
    .join('rect')
    .attr('x', d => x0(String(d[xKey]))! + x1(d.category)!)
    .attr('y', d => y(d[d.category] ?? 0))
    .attr('width', x1.bandwidth())
    .attr('height', d => innerHeight - y(d[d.category] ?? 0))
    .attr('title', d => `${d.category}: ${d[d.category]?.toFixed(1)}`);

  // Axes
  svg.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x0));

  svg.append('g')
    .call(d3.axisLeft(y));

  svg.append('text')
    .attr('x', innerWidth / 2)
    .attr('y', innerHeight + margin.bottom - 5)
    .attr('text-anchor', 'middle')
    .text(xLabel);
}

function renderBarChart(
  container: HTMLElement,
  data: Array<{ name: string; median_key: number }>,
  xLabel: string,
): void {
  const width = container.clientWidth || 600;
  const height = container.clientHeight || 300;
  const margin = { top: 20, right: 20, bottom: 30, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  container.innerHTML = '';

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand()
    .domain(data.map(d => d.name))
    .range([0, innerWidth])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, Math.max(...data.map(d => d.median_key))])
    .range([innerHeight, 0]);

  // Draw bars
  svg.selectAll('rect')
    .data(data)
    .join('rect')
    .attr('x', d => x(d.name)!)
    .attr('y', d => y(d.median_key))
    .attr('width', x.bandwidth())
    .attr('height', d => innerHeight - y(d.median_key))
    .attr('fill', '#1f77b4')
    .attr('title', d => `${d.name}: ${d.median_key.toFixed(1)}`);

  // Axes
  svg.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x));

  svg.append('g')
    .call(d3.axisLeft(y));

  svg.append('text')
    .attr('x', innerWidth / 2)
    .attr('y', innerHeight + margin.bottom - 5)
    .attr('text-anchor', 'middle')
    .text(xLabel);
}
