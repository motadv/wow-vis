import { setState, subscribe } from '../state.js';
import type { SeasonMeta } from '../types.js';

export function initScrubber(container: HTMLElement, seasons: SeasonMeta[]): void {
  const sorted = [...seasons].sort((a, b) => a.id - b.id);

  for (const season of sorted) {
    const btn = document.createElement('button');
    btn.dataset.seasonId = String(season.id);
    btn.textContent = season.name.replace(/^Mythic\+ Dungeons \(/, '').replace(/\)$/, '');
    btn.style.cssText = 'padding:4px 10px;border-radius:4px;border:1px solid #3f3f46;background:#27272a;color:#e4e4e7;cursor:pointer;font-size:12px;white-space:nowrap';
    btn.addEventListener('click', () => setState({ selectedSeason: season.id, selectedDungeon: null }));
    container.appendChild(btn);
  }

  subscribe((state) => {
    container.querySelectorAll<HTMLButtonElement>('button').forEach(btn => {
      const active = Number(btn.dataset.seasonId) === state.selectedSeason;
      btn.style.background = active ? '#3b82f6' : '#27272a';
      btn.style.borderColor = active ? '#60a5fa' : '#3f3f46';
    });
  });
}
