import type { AppState, Era } from './types';

const state: AppState = {
  selectedSeason: -1,
  selectedDungeon: null,
  viewMode: 'era',
  filterEras: [] as Era[],
};

type Listener = (s: AppState) => void;
const listeners = new Set<Listener>();

export function getState(): AppState {
  return state;
}

export function setState(patch: Partial<AppState>): void {
  Object.assign(state, patch);
  listeners.forEach(fn => fn(state));
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
