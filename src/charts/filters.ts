import { getState, setState, subscribe } from '../state.js';
import { ERAS_IN_ORDER, ERA_LABELS, ERA_PALETTE } from '../config.js';
import type { Era } from '../types.js';

export function initFilters(container: HTMLElement): void {
  // Era toggles
  const eraGroup = document.createElement('div');
  eraGroup.style.cssText = 'display:flex;gap:4px;flex:1;flex-wrap:wrap';

  for (const era of ERAS_IN_ORDER) {
    const btn = document.createElement('button');
    btn.dataset.era = era;
    btn.textContent = ERA_LABELS[era].split(' ').map(w => w[0]).join('');
    btn.title = ERA_LABELS[era];
    btn.style.cssText = `padding:3px 8px;border-radius:4px;border:1px solid #3f3f46;background:${ERA_PALETTE[era]}33;color:#e4e4e7;cursor:pointer;font-size:11px`;
    btn.addEventListener('click', () => {
      const { filterEras } = getState();
      const next = filterEras.includes(era)
        ? filterEras.filter(e => e !== era)
        : [...filterEras, era];
      setState({ filterEras: next });
    });
    eraGroup.appendChild(btn);
  }

  // View mode toggle
  const modeGroup = document.createElement('div');
  modeGroup.style.cssText = 'display:flex;gap:4px;margin-left:auto';

  for (const mode of ['era', 'reintroduction'] as const) {
    const btn = document.createElement('button');
    btn.dataset.mode = mode;
    btn.textContent = mode === 'era' ? 'Era View' : 'Reintroduction View';
    btn.style.cssText = 'padding:3px 10px;border-radius:4px;border:1px solid #3f3f46;background:#27272a;color:#e4e4e7;cursor:pointer;font-size:12px';
    btn.addEventListener('click', () => setState({ viewMode: mode }));
    modeGroup.appendChild(btn);
  }

  container.appendChild(eraGroup);
  container.appendChild(modeGroup);

  subscribe((state) => {
    const activeEras = new Set<Era>(state.filterEras);
    eraGroup.querySelectorAll<HTMLButtonElement>('button').forEach(btn => {
      const era = btn.dataset.era as Era;
      const active = activeEras.size === 0 || activeEras.has(era);
      btn.style.opacity = active ? '1' : '0.35';
      btn.style.borderColor = activeEras.has(era) ? '#ffffff' : '#3f3f46';
    });
    modeGroup.querySelectorAll<HTMLButtonElement>('button').forEach(btn => {
      const active = btn.dataset.mode === state.viewMode;
      btn.style.background = active ? '#3b82f6' : '#27272a';
      btn.style.borderColor = active ? '#60a5fa' : '#3f3f46';
    });
  });
}
