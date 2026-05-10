import type {
  BlizzardSeasonIndex,
  BlizzardSeason,
  BlizzardLeaderboard,
} from './types.js';

const BASE_URL = 'https://us.api.blizzard.com';

async function get<T>(path: string, token: string): Promise<T> {
  const url = `${BASE_URL}${path}?namespace=dynamic-us&locale=en_US`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json() as T;
}

export async function fetchSeasonIds(token: string): Promise<number[]> {
  const data = await get<BlizzardSeasonIndex>('/data/wow/mythic-keystone/season/', token);
  return data.seasons.map(s => s.id);
}

export async function fetchSeason(token: string, seasonId: number): Promise<BlizzardSeason> {
  return get<BlizzardSeason>(`/data/wow/mythic-keystone/season/${seasonId}`, token);
}

export async function fetchPeriodIds(token: string, seasonId: number): Promise<number[]> {
  const data = await get<BlizzardSeason>(`/data/wow/mythic-keystone/season/${seasonId}`, token);
  return data.periods.map(p => p.id);
}

export async function fetchLeaderboard(
  token: string,
  realmId: number,
  dungeonId: number,
  periodId: number,
): Promise<BlizzardLeaderboard> {
  const data = await get<Omit<BlizzardLeaderboard, 'map_challenge_mode_id'>>(
    `/data/wow/connected-realm/${realmId}/mythic-leaderboard/${dungeonId}/period/${periodId}`,
    token,
  );
  return { ...data, map_challenge_mode_id: dungeonId };
}
