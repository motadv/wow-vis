import type { Era } from './types';

export const MAP_WIDTH = 2048;
export const MAP_HEIGHT = 1400;
export const OFF_WORLD_X = 1900;
export const OFF_WORLD_Y = 900;

export const ERA_PALETTE: Record<Era, string> = {
  vanilla:      '#C79C6E',
  tbc:          '#A9D271',
  wotlk:        '#69CCF0',
  cataclysm:    '#FF7D0A',
  mop:          '#00FF96',
  wod:          '#C4A35A',
  legion:       '#A335EE',
  bfa:          '#0070DD',
  shadowlands:  '#9482C9',
  dragonflight: '#E6A817',
  tww:          '#33C7A0',
  midnight:     '#5C4ADB',
};

export const ERA_LABELS: Record<Era, string> = {
  vanilla:      'Classic',
  tbc:          'TBC',
  wotlk:        'Wrath',
  cataclysm:    'Cataclysm',
  mop:          'Mists',
  wod:          'Warlords',
  legion:       'Legion',
  bfa:          'BfA',
  shadowlands:  'Shadowlands',
  dragonflight: 'Dragonflight',
  tww:          'The War Within',
  midnight:     'Midnight',
};

export const ERAS_IN_ORDER: Era[] = [
  'vanilla', 'tbc', 'wotlk', 'cataclysm', 'mop', 'wod',
  'legion', 'bfa', 'shadowlands', 'dragonflight', 'tww', 'midnight',
];
