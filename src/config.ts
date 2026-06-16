import type { Era } from "./types.js";

export const MAP_WIDTH = 3840;
export const MAP_HEIGHT = 2560;

// Off-world cluster position
export const OFF_WORLD_X = 2790;
export const OFF_WORLD_Y = 2409;

export const MAX_SEASON = 12;
export const DISABLED_SEASONS = new Set([5, 9]);

export const ERAS_IN_ORDER: Era[] = [
  "vanilla",
  "tbc",
  "wotlk",
  "cataclysm",
  "mop",
  "wod",
  "legion",
  "bfa",
  "shadowlands",
  "dragonflight",
  "tww",
  "midnight",
];

export const ERA_LABELS: Record<Era, string> = {
  vanilla: "Vanilla",
  tbc: "The Burning Crusade",
  wotlk: "Wrath of the Lich King",
  cataclysm: "Cataclysm",
  mop: "Mists of Pandaria",
  wod: "Warlords of Draenor",
  legion: "Legion",
  bfa: "Battle for Azeroth",
  shadowlands: "Shadowlands",
  dragonflight: "Dragonflight",
  tww: "The War Within",
  midnight: "Midnight",
};

export const ERA_PALETTE: Record<Era, string> = {
  vanilla: "#c8a96e",
  tbc: "#7cba5c",
  wotlk: "#6baed6",
  cataclysm: "#a95741ff",
  mop: "#c96e8a",
  wod: "#4d987eff",
  legion: "#9b59b6",
  bfa: "#5091bbff",
  shadowlands: "#8899bb",
  dragonflight: "#c79544ff",
  tww: "#50c878",
  midnight: "#c060d8",
};
