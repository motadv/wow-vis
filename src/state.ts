import type { AppState } from './types.js';

// Estado global mínimo: apenas dungeons selecionadas e temporada em destaque no Arc Chart.
// Dois atributos são suficientes para coordenar as três views (§3.4 do relatório).
let state: AppState = {
  selectedDungeons: [],
  selectedSeasonForArc: null,
};

type Listener = (state: AppState) => void;
// Set garante que cada módulo se registre uma única vez sem duplicatas.
const listeners = new Set<Listener>();

export function getState(): AppState {
  return state;
}

// setState aplica patch parcial e notifica todos os ouvintes — padrão pub/sub.
// Qualquer interação do usuário (clique no Dungeon Browser, Arc Chart ou Affix Chart)
// passa por aqui, propagando a mudança para todas as views simultaneamente (§3.4).
export function setState(patch: Partial<AppState>): void {
  state = { ...state, ...patch };
  for (const fn of listeners) fn(state);
}

// Retorna função de cancelamento para que módulos possam se desregistrar se necessário.
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Adiciona ou remove dungeonId de selectedDungeons — suporta seleção múltipla (T3).
// A mudança de modo (single → multi) é implícita: basta clicar em mais uma tile.
export function toggleDungeonSelection(dungeonId: number): void {
  const current = getState();
  const index = current.selectedDungeons.indexOf(dungeonId);

  let newSelectedDungeons: number[];
  if (index > -1) {
    newSelectedDungeons = current.selectedDungeons.filter(id => id !== dungeonId);
  } else {
    newSelectedDungeons = [...current.selectedDungeons, dungeonId];
  }

  setState({ selectedDungeons: newSelectedDungeons });
}
