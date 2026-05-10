import type { SeasonMeta } from '../types';
import { getState, setState, subscribe } from '../state';

export function initScrubber(container: HTMLElement, seasons: SeasonMeta[]): void {
  const sorted = [...seasons].sort((a, b) => a.id - b.id);

  sorted.forEach(season => {
    const btn = document.createElement('button');
    btn.textContent = season.name;
    btn.dataset['seasonId'] = String(season.id);
    Object.assign(btn.style, {
      padding: '4px 14px',
      borderRadius: '9999px',
      border: '1px solid #3f3f46',
      background: 'transparent',
      color: '#a1a1aa',
      fontSize: '13px',
      cursor: 'pointer',
      transition: 'border-color 0.15s, color 0.15s',
    });
    btn.addEventListener('click', () => {
      setState({ selectedSeason: season.id, selectedDungeon: null });
    });
    container.appendChild(btn);
  });

  const highlight = (selectedSeason: number) => {
    container.querySelectorAll<HTMLButtonElement>('button').forEach(btn => {
      const active = Number(btn.dataset['seasonId']) === selectedSeason;
      btn.style.borderColor = active ? '#ffffff' : '#3f3f46';
      btn.style.color = active ? '#ffffff' : '#a1a1aa';
    });
  };

  subscribe(({ selectedSeason }) => highlight(selectedSeason));
  highlight(getState().selectedSeason);
}
