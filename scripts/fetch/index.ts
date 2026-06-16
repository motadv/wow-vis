import { fetchToken } from './auth.js';
import { fetchAllDungeons, fetchSeasonIds, fetchSeason, fetchLeaderboard } from './blizzard.js';
import { transformLeaderboard } from './transform.js';
import { ensureOutDir, writeParquet, readManifest, writeManifest, writeAffixManifest } from './write.js';
import type { AffixManifest, DungeonManifest, DungeonMeta, SeasonMeta, LeaderboardEntry } from './types.js';

const clientId = process.env.VITE_BLIZZARD_CLIENT_ID;
const clientSecret = process.env.VITE_BLIZZARD_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  throw new Error('Missing VITE_BLIZZARD_CLIENT_ID or VITE_BLIZZARD_CLIENT_SECRET in environment');
}

const SLEEP_MS = 35; // Reduced from 55ms to allow parallel fetching with 3x concurrency
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type ProcessSeasonResult =
  | {
      success: true;
      seasonId: number;
      seasonMeta: SeasonMeta;
      dungeonMap: Map<number, DungeonMeta>;
      affixData: Record<number, Affix[]>;
    }
  | {
      success: false;
      seasonId: number;
      error: string;
    };

async function discoverActiveDungeons(
  token: string,
  allDungeonIds: number[],
  periods: number[],
  realmId: number,
): Promise<number[]> {
  for (const periodId of periods) {
    const active: number[] = [];
    for (const dungeonId of allDungeonIds) {
      await sleep(SLEEP_MS);
      try {
        const lb = await fetchLeaderboard(token, realmId, dungeonId, periodId);
        if (lb.leading_groups && lb.leading_groups.length > 0) {
          active.push(dungeonId);
        }
      } catch {
        // dungeon not active in this period/season
      }
    }
    if (active.length > 0) return active;
    console.log(`    Period ${periodId} returned no data, trying next period...`);
  }
  return [];
}

async function processSeason(
  token: string,
  seasonId: number,
  allDungeonIds: number[],
  dungeonNameById: Map<number, string>,
  realmIds: number[],
  dungeonMap: Map<number, DungeonMeta>,
): Promise<ProcessSeasonResult> {
  try {
    const season = await fetchSeason(token, seasonId);

    if (!season.end_timestamp || season.end_timestamp > Date.now()) {
      console.log(`Skipping season ${seasonId} (${season.season_name}) — not yet ended`);
      return { success: false, seasonId, error: 'Season not ended' };
    }

    console.log(`\nProcessing season ${seasonId}: ${season.season_name}`);
    const periods = season.periods.map(p => p.id);

    console.log(`  Discovering active dungeons across ${periods.length} periods on realm ${realmIds[0]}...`);
    const activeDungeonIds = await discoverActiveDungeons(
      token, allDungeonIds, periods, realmIds[0],
    );
    console.log(`  Active dungeons: ${activeDungeonIds.join(', ')}`);

    if (activeDungeonIds.length === 0) {
      console.log(`  ⚠️  No active dungeons found; skipping season`);
      return { success: false, seasonId, error: 'No active dungeons' };
    }

    for (const dungeonId of activeDungeonIds) {
      if (!dungeonMap.has(dungeonId)) {
        dungeonMap.set(dungeonId, {
          id: dungeonId,
          name: dungeonNameById.get(dungeonId) ?? `Dungeon ${dungeonId}`,
          abbrev: '???',
          era: 'vanilla',
          zone: 'unknown',
          offWorld: false,
        });
      }
    }

    const seasonMeta: SeasonMeta = {
      id: season.id,
      name: season.season_name ?? `Season ${seasonId}`,
      startTimestamp: season.start_timestamp,
      dungeonIds: activeDungeonIds,
    };

    const allEntries: LeaderboardEntry[] = [];
    const affixData: Record<number, Affix[]> = {};

    for (const dungeonId of activeDungeonIds) {
      for (const realmId of realmIds) {
        for (const periodId of periods) {
          try {
            await sleep(SLEEP_MS);
            const lb = await fetchLeaderboard(token, realmId, dungeonId, periodId);
            if (!lb.leading_groups || lb.leading_groups.length === 0) continue;

            const entries = transformLeaderboard(lb, seasonId, realmId);
            allEntries.push(...entries);

            if (!affixData[periodId]) {
              affixData[periodId] = (lb.keystone_affixes ?? []).map(affix => ({
                id: affix.keystone_affix.id,
                name: affix.keystone_affix.name,
              }));
            }
          } catch (err) {
            console.warn(`    Skip realm=${realmId} dungeon=${dungeonId} period=${periodId}: ${(err as Error).message}`);
          }
        }
      }
    }

    console.log(`  Collected ${allEntries.length} entries — writing Parquet...`);
    await writeParquet(seasonId, allEntries);
    console.log(`  Written public/data/season-${seasonId}.parquet`);

    return {
      success: true,
      seasonId,
      seasonMeta,
      dungeonMap: new Map(), // Empty map; dungeons were added to shared dungeonMap above
      affixData,
    };
  } catch (err) {
    console.error(`Season ${seasonId} failed: ${(err as Error).message}`);
    return {
      success: false,
      seasonId,
      error: (err as Error).message,
    };
  }
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

  const fetchSeasonsEnv = process.env.FETCH_SEASONS;
  const targetSeasons = fetchSeasonsEnv
    ? fetchSeasonsEnv.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
    : null;

  const allSeasonIds = await fetchSeasonIds(token);
  const seasonIds = targetSeasons
    ? allSeasonIds.filter(id => targetSeasons.includes(id))
    : allSeasonIds;
  if (targetSeasons) {
    console.log(`Targeting seasons: ${seasonIds.join(', ')} (FETCH_SEASONS=${fetchSeasonsEnv})`);
  } else {
    console.log(`Found ${seasonIds.length} seasons: ${seasonIds.join(', ')}`);
  }

  const dungeonMap = new Map<number, DungeonMeta>();

  const batchSize = 3;
  const seasonResults: ProcessSeasonResult[] = [];
  const failed: Array<{ seasonId: number; error: string }> = [];

  for (let i = 0; i < seasonIds.length; i += batchSize) {
    const batch = seasonIds.slice(i, i + batchSize);
    console.log(`\n📦 Processing batch: ${batch.join(', ')}`);

    const promises = batch.map(seasonId =>
      processSeason(token, seasonId, allDungeonIds, dungeonNameById, realmIds, dungeonMap)
    );

    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === 'fulfilled') {
        seasonResults.push(result.value);
        if (!result.value.success) {
          failed.push({ seasonId: result.value.seasonId, error: result.value.error });
        }
      } else {
        console.error(`Unexpected rejection in batch: ${result.reason}`);
        failed.push({ seasonId: -1, error: String(result.reason) });
      }
    }
  }

  // Build season list and affix manifest from successful results
  const seasons_final: SeasonMeta[] = [];
  const affixManifest_final: AffixManifest = {};

  for (const result of seasonResults) {
    if (result.success) {
      seasons_final.push(result.seasonMeta);

      // Merge affix data: seasonId → periodId → affixes
      if (!affixManifest_final[result.seasonId]) {
        affixManifest_final[result.seasonId] = {};
      }
      for (const [periodId, affixes] of Object.entries(result.affixData)) {
        affixManifest_final[result.seasonId][periodId] = affixes;
      }
    }
  }

  if (targetSeasons) {
    const manifest = await readManifest();
    for (const result of seasonResults) {
      if (!result.success) continue;
      const existing = manifest.seasons.find(s => s.id === result.seasonId);
      if (existing) {
        existing.dungeonIds = result.seasonMeta.dungeonIds;
        console.log(`  Updated dungeonIds for season ${result.seasonId}: [${result.seasonMeta.dungeonIds.join(', ')}]`);
      } else {
        manifest.seasons.push(result.seasonMeta);
        console.log(`  Added season ${result.seasonId} to manifest`);
      }
    }
    await writeManifest(manifest);
    console.log('\nUpdated dungeonIds in public/data/dungeons.json (manual metadata preserved).');
  } else {
    const manifest: DungeonManifest = {
      dungeons: Array.from(dungeonMap.values()),
      seasons: seasons_final,
      zones: [],
    };

    await writeManifest(manifest);
    console.log('\nWritten public/data/dungeons.json');

    await writeAffixManifest(affixManifest_final);
    console.log('Written public/data/affixes.json');
  }

  if (failed.length > 0) {
    console.log('\n⚠️  Failed seasons:');
    for (const { seasonId, error } of failed) {
      if (seasonId !== -1) {
        console.log(`   Season ${seasonId}: ${error}`);
      } else {
        console.log(`   Unknown: ${error}`);
      }
    }

    if (failed.length === seasonIds.length) {
      console.error('\n❌ All seasons failed. Exiting with error.');
      process.exit(1);
    } else {
      console.log(`\n✅ ${seasons_final.length}/${seasonIds.length} seasons succeeded. Re-run fetch to retry failed seasons.`);
    }
  }

  console.log('\nDone. Remember to manually fill era, mapX, mapY, offWorld in dungeons.json.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
