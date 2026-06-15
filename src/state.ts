import type { AppState } from './types.js';

let state: AppState = {
  selectedDungeon: null,
  selectedDungeons: [],
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

export function toggleDungeonSelection(dungeonId: number): void {
  const state = getState();
  const index = state.selectedDungeons.indexOf(dungeonId);
  let newSelectedDungeons: number[];
  let newSelectedDungeon: number | null;

  if (index > -1) {
    newSelectedDungeons = state.selectedDungeons.filter(id => id !== dungeonId);
    newSelectedDungeon = newSelectedDungeons.length === 1 ? newSelectedDungeons[0] : null;
  } else {
    newSelectedDungeons = [...state.selectedDungeons, dungeonId];
    newSelectedDungeon = newSelectedDungeons.length === 1 ? dungeonId : null;
  }

  setState({
    selectedDungeons: newSelectedDungeons,
    selectedDungeon: newSelectedDungeon,
  });
}
