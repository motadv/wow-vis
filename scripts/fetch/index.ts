import { fetchToken } from './auth.js';
import { fetchAllDungeons, fetchSeasonIds, fetchSeason, fetchLeaderboard } from './blizzard.js';
import { transformLeaderboard } from './transform.js';
import { ensureOutDir, writeParquet, writeManifest, writeAffixManifest } from './write.js';
import type { AffixManifest, DungeonManifest, DungeonMeta, SeasonMeta, LeaderboardEntry } from './types.js';

const clientId = process.env.VITE_BLIZZARD_CLIENT_ID;
const clientSecret = process.env.VITE_BLIZZARD_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  throw new Error('Missing VITE_BLIZZARD_CLIENT_ID or VITE_BLIZZARD_CLIENT_SECRET in environment');
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function discoverActiveDungeons(
  token: string,
  allDungeonIds: number[],
  periods: number[],
  realmId: number,
): Promise<{ dungeonIds: number[]; activePeriodId: number | null }> {
  // Try each period in order; stop as soon as we find one with data.
  for (const periodId of periods) {
    const active: number[] = [];
    for (const dungeonId of allDungeonIds) {
      await sleep(55);
      try {
        const lb = await fetchLeaderboard(token, realmId, dungeonId, periodId);
        if (lb.leading_groups && lb.leading_groups.length > 0) {
          active.push(dungeonId);
        }
      } catch {
        // dungeon not active in this period/season
      }
    }
    if (active.length > 0) return { dungeonIds: active, activePeriodId: periodId };
    console.log(`      Period ${periodId} → no active dungeons, trying next...`);
  }
  return { dungeonIds: [], activePeriodId: null };
}

async function main() {
  console.log('Authenticating...');
  const token = await fetchToken(clientId!, clientSecret!);

  await ensureOutDir();

  // Verified high-population US connected realms (Area 52, Stormrage, Illidan, Mal'Ganis, Tichondrius)
  const realmIds = [3676, 60, 57, 3684, 11];

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
  const affixManifest: AffixManifest = {};

  for (const seasonId of seasonIds) {
    const season = await fetchSeason(token, seasonId);

    if (!season.end_timestamp || season.end_timestamp > now) {
      console.log(`Skipping season ${seasonId} (${season.season_name}) — not yet ended`);
      continue;
    }

    console.log(`\nProcessing season ${seasonId}: ${season.season_name}`);
    const periods = season.periods.map(p => p.id);

    console.log(`  Discovering active dungeons across ${periods.length} periods on realm ${realmIds[0]}...`);
    const { dungeonIds: activeDungeonIds, activePeriodId } = await discoverActiveDungeons(
      token, allDungeonIds, periods, realmIds[0],
    );
    console.log(`  Active dungeons: ${activeDungeonIds.join(', ')} (period ${activePeriodId})`);

    if (activePeriodId === null) {
      console.log(`  ⚠️  No active period found across ${periods.length} periods; skipping leaderboard fetch`);
      continue;
    }

    for (const dungeonId of activeDungeonIds) {
      if (!dungeonMap.has(dungeonId)) {
        dungeonMap.set(dungeonId, {
          id: dungeonId,
          name: dungeonNameById.get(dungeonId) ?? `Dungeon ${dungeonId}`,
          abbrev: '???',    // placeholder — fill manually
          era: 'vanilla',   // placeholder — fill manually
          zone: 'unknown',  // placeholder — fill manually
          offWorld: false,  // placeholder — fill manually
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
      for (const realmId of realmIds) {
        try {
          await sleep(55);
          const lb = await fetchLeaderboard(token, realmId, dungeonId, activePeriodId);
          const entries = transformLeaderboard(lb, seasonId, realmId);
          allEntries.push(...entries);

          // Accumulate affix manifest: season → period → affixes
          if (!affixManifest[seasonId]) {
            affixManifest[seasonId] = {};
          }
          if (!affixManifest[seasonId][activePeriodId]) {
            affixManifest[seasonId][activePeriodId] = (lb.keystone_affixes ?? []).map(affix => ({
              id: affix.keystone_affix.id,
              name: affix.keystone_affix.name,
            }));
          }
        } catch (err) {
          console.warn(`    Skip realm=${realmId} dungeon=${dungeonId} period=${activePeriodId}: ${(err as Error).message}`);
        }
      }
    }

    console.log(`  Collected ${allEntries.length} entries from period ${activePeriodId} — writing Parquet...`);
    await writeParquet(seasonId, allEntries);
    console.log(`  Written public/data/season-${seasonId}.parquet`);
  }

  const manifest: DungeonManifest = {
    dungeons: Array.from(dungeonMap.values()),
    seasons,
    zones: [],
  };

  await writeManifest(manifest);
  console.log('\nWritten public/data/dungeons.json');

  await writeAffixManifest(affixManifest);
  console.log('Written public/data/affixes.json');

  console.log('\nDone. Remember to manually fill era, mapX, mapY, offWorld in dungeons.json.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
