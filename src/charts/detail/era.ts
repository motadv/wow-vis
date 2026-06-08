import * as d3 from 'd3';
import { ERAS_IN_ORDER, ERA_LABELS, ERA_PALETTE } from '../../config.js';
import type { DungeonMeta, DungeonManifest, VolumeRow } from '../../types.js';

export function renderEraView(
  container: HTMLElement,
  dungeon: DungeonMeta,
  thisVolume: VolumeRow | undefined,
  allVolume: VolumeRow[],
  manifest: DungeonManifest,
): void {
  container.innerHTML = '';

  // Per-era average entry count across all dungeons
  const eraTotals = new Map<string, { sum: number; count: number }>();
  for (const row of allVolume) {
    const d = manifest.dungeons.find(x => x.id === row.dungeon_id);
    if (!d) continue;
    const prev = eraTotals.get(d.era) ?? { sum: 0, count: 0 };
    eraTotals.set(d.era, { sum: prev.sum + row.entry_count, count: prev.count + 1 });
  }

  const eras = ERAS_IN_ORDER.filter(e => eraTotals.has(e));
  const eraAvgs = eras.map(e => {
    const t = eraTotals.get(e)!;
    return { era: e, avg: t.sum / t.count };
  }).sort((a, b) => b.avg - a.avg);

  const maxAvg = d3.max(eraAvgs, d => d.avg) ?? 1;
  const thisCount = thisVolume?.entry_count ?? 0;

  const section = document.createElement('div');
  section.style.cssText = 'padding:16px';

  const subtitle = document.createElement('p');
  subtitle.style.cssText = 'margin:0 0 12px;font-size:12px;color:#a1a1aa';
  subtitle.textContent = thisVolume
    ? `${thisCount} entries · max key ${thisVolume.max_key}`
    : 'No data for this season';
  section.appendChild(subtitle);

  const label = document.createElement('p');
  label.style.cssText = 'margin:0 0 8px;font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em';
  label.textContent = 'Average entries by era';
  section.appendChild(label);

  for (const { era, avg } of eraAvgs) {
    const isThis = era === dungeon.era;
    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom:6px';

    const nameEl = document.createElement('div');
    nameEl.style.cssText = `font-size:11px;color:${isThis ? '#ffffff' : '#a1a1aa'};margin-bottom:2px;display:flex;justify-content:space-between`;
    const nameSpan = document.createElement('span');
    nameSpan.textContent = ERA_LABELS[era];
    const avgSpan = document.createElement('span');
    avgSpan.textContent = String(Math.round(avg));
    nameEl.appendChild(nameSpan);
    nameEl.appendChild(avgSpan);
    row.appendChild(nameEl);

    const track = document.createElement('div');
    track.style.cssText = 'height:8px;background:#27272a;border-radius:4px;overflow:hidden;position:relative';

    const bar = document.createElement('div');
    bar.style.cssText = `height:100%;width:${(avg / maxAvg) * 100}%;background:${ERA_PALETTE[era]};border-radius:4px;opacity:${isThis ? 1 : 0.5}`;
    track.appendChild(bar);

    if (isThis && thisCount > 0) {
      const overlay = document.createElement('div');
      overlay.style.cssText = `position:absolute;top:0;left:0;height:100%;width:${Math.min((thisCount / maxAvg) * 100, 100)}%;background:rgba(255,255,255,0.35);border-radius:4px`;
      track.appendChild(overlay);
    }

    row.appendChild(track);
    section.appendChild(row);
  }

  container.appendChild(section);
}
