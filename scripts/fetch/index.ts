import { fetchToken } from './auth.js';
import { fetchAllDungeons, fetchSeasonIds, fetchSeason, fetchLeaderboard } from './blizzard.js';
import { transformLeaderboard } from './transform.js';
import { ensureOutDir, writeParquet, writeManifest } from './write.js';
import type { DungeonManifest, DungeonMeta, SeasonMeta, LeaderboardEntry } from './types.js';

// High-population US connected realm IDs
const SAMPLE_REALM_IDS = [11, 3, 4, 57];

const clientId = process.env.VITE_BLIZZARD_CLIENT_ID;
const clientSecret = process.env.VITE_BLIZZARD_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  throw new Error('Missing VITE_BLIZZARD_CLIENT_ID or VITE_BLIZZARD_CLIENT_SECRET in environment');
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function discoverActiveDungeons(
  token: string,
  allDungeonIds: number[],
  periodId: number,
  realmId: number,
): Promise<number[]> {
  const active: number[] = [];
  for (const dungeonId of allDungeonIds) {
    await sleep(55);
    try {
      const lb = await fetchLeaderboard(token, realmId, dungeonId, periodId);
      if (lb.leading_groups && lb.leading_groups.length > 0) {
        active.push(dungeonId);
      }
    } catch {
      // dungeon not active in this season
    }
  }
  return active;
}

async function main() {
  console.log('Authenticating...');
  const token = await fetchToken(clientId!, clientSecret!);

  await ensureOutDir();

  console.log('Fetching all M+ dungeons...');
  const allDungeons = await fetchAllDungeons(token);
  const allDungeonIds = allDungeons.map(d => d.id);
  const dungeonNameById = new Map(allDungeons.map(d => [d.id, d.name]));
  console.log(`Known dungeon pool: ${allDungeonIds.length} dungeons`);

  const now = Date.now();
  const seasonIds = await fetchSeasonIds(token);
  console.log(`Found ${seasonIds.length} seasons: ${seasonIds.join(', ')}`);

  const dungeonMap = new Map<number, DungeonMeta>();
  const seasons: SeasonMeta[] = [];

  for (const seasonId of seasonIds) {
    const season = await fetchSeason(token, seasonId);

    if (!season.end_timestamp || season.end_timestamp > now) {
      console.log(`Skipping season ${seasonId} (${season.season_name}) — not yet ended`);
      continue;
    }

    console.log(`\nProcessing season ${seasonId}: ${season.season_name}`);
    const periods = season.periods.map(p => p.id);
    const probePeriod = periods[0];

    console.log(`  Discovering active dungeons via period ${probePeriod} on realm ${SAMPLE_REALM_IDS[0]}...`);
    const activeDungeonIds = await discoverActiveDungeons(
      token, allDungeonIds, probePeriod, SAMPLE_REALM_IDS[0],
    );
    console.log(`  Active dungeons: ${activeDungeonIds.join(', ')}`);

    for (const dungeonId of activeDungeonIds) {
      if (!dungeonMap.has(dungeonId)) {
        dungeonMap.set(dungeonId, {
          id: dungeonId,
          name: dungeonNameById.get(dungeonId) ?? `Dungeon ${dungeonId}`,
          era: 'vanilla',     // placeholder — fill manually
          mapX: 0,            // placeholder — fill manually
          mapY: 0,            // placeholder — fill manually
          offWorld: false,    // placeholder — fill manually
        });
      }
    }

    const seasonMeta: SeasonMeta = {
      id: season.id,
      name: season.season_name ?? `Season ${seasonId}`,
      startTimestamp: season.start_timestamp,
      dungeonIds: activeDungeonIds,
    };
    seasons.push(seasonMeta);

    const allEntries: LeaderboardEntry[] = [];

    for (const dungeonId of activeDungeonIds) {
      for (const realmId of SAMPLE_REALM_IDS) {
        for (const periodId of periods) {
          try {
            await sleep(55);
            const lb = await fetchLeaderboard(token, realmId, dungeonId, periodId);
            const entries = transformLeaderboard(lb, seasonId, realmId);
            allEntries.push(...entries);
          } catch (err) {
            console.warn(`    Skip realm=${realmId} dungeon=${dungeonId} period=${periodId}: ${(err as Error).message}`);
          }
        }
      }
    }

    console.log(`  Collected ${allEntries.length} entries — writing Parquet...`);
    await writeParquet(seasonId, allEntries);
    console.log(`  Written public/data/season-${seasonId}.parquet`);
  }

  const manifest: DungeonManifest = {
    dungeons: Array.from(dungeonMap.values()),
    seasons,
  };

  await writeManifest(manifest);
  console.log('\nWritten public/data/dungeons.json');
  console.log('\nDone. Remember to manually fill era, mapX, mapY, offWorld in dungeons.json.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
