import type { AppState } from './types.js';

let state: AppState = {
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
  const current = getState();
  const index = current.selectedDungeons.indexOf(dungeonId);

  let newSelectedDungeons: number[];
  if (index > -1) {
    newSelectedDungeons = current.selectedDungeons.filter(id => id !== dungeonId);
  } else {
    if (current.selectedDungeons.length >= 4) return;
    newSelectedDungeons = [...current.selectedDungeons, dungeonId];
  }

  setState({ selectedDungeons: newSelectedDungeons });
}

export function selectOnlyDungeon(dungeonId: number): void {
  setState({
    selectedDungeons: [dungeonId],
    selectedSeasonForArc: null,
  });
}
