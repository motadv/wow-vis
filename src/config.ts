import type { Era } from './types.js';

export const MAP_WIDTH = 2048;
export const MAP_HEIGHT = 1400;

// Off-world cluster position (top-right corner)
export const OFF_WORLD_X = 1850;
export const OFF_WORLD_Y = 120;

export const ERAS_IN_ORDER: Era[] = [
  'vanilla', 'tbc', 'wotlk', 'cataclysm', 'mop', 'wod',
  'legion', 'bfa', 'shadowlands', 'dragonflight', 'tww', 'midnight',
];

export const ERA_LABELS: Record<Era, string> = {
  vanilla: 'Vanilla',
  tbc: 'The Burning Crusade',
  wotlk: 'Wrath of the Lich King',
  cataclysm: 'Cataclysm',
  mop: 'Mists of Pandaria',
  wod: 'Warlords of Draenor',
  legion: 'Legion',
  bfa: 'Battle for Azeroth',
  shadowlands: 'Shadowlands',
  dragonflight: 'Dragonflight',
  tww: 'The War Within',
  midnight: 'Midnight',
};

export const ERA_PALETTE: Record<Era, string> = {
  vanilla: '#c8a96e',
  tbc: '#7cba5c',
  wotlk: '#6baed6',
  cataclysm: '#e06c4c',
  mop: '#c96e8a',
  wod: '#a08060',
  legion: '#9b59b6',
  bfa: '#2980b9',
  shadowlands: '#8899bb',
  dragonflight: '#e8a030',
  tww: '#50c878',
  midnight: '#c060d8',
};
