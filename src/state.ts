import type { AppState } from './types.js';

let state: AppState = {
  selectedDungeon: null,
  selectedSeasonForArc: null,
  affixLens: 'trend',
  affixFilters: {
    dungeonId: null,
    seasonId: null,
    fortified: null,
    secondaryAffixId: null,
  },
};

type Listener = (state: AppState) => void;
const listeners = new Set<Listener>();

export function getState(): AppState {
  return state;
}

export function setState(patch: Partial<AppState>): void {
  state = { ...state, ...patch };
  for (const fn of listeners) fn(state);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
