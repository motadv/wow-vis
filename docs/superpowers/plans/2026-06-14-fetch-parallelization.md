# Parallel Season Fetching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce fetch pipeline runtime from ~7 hours to ~2-3 hours by processing 3 seasons in parallel instead of sequentially.

**Architecture:** Extract season processing into a reusable function, then batch seasons into groups of 3, using `Promise.allSettled()` to run each batch in parallel. Collect results and merge dungeon/affix manifests at the end.

**Tech Stack:** TypeScript, Node.js async/await, `Promise.allSettled()` for concurrency, existing Blizzard API client

---

## Task 1: Define Sleep Constant and Update Sleep Calls

**Files:**
- Modify: `scripts/fetch/index.ts`

- [ ] **Step 1: Add sleep constant at top of file**

Open `scripts/fetch/index.ts`. Find line 13 with `const sleep = (ms: number) => ...` and replace it with:

```typescript
const SLEEP_MS = 35; // Reduced from 55ms to allow parallel fetching with 3x concurrency
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
```

- [ ] **Step 2: Replace sleep(55) calls with sleep(SLEEP_MS)**

Find `discoverActiveDungeons()` function around line 25. Change:
```typescript
await sleep(55);
```
to:
```typescript
await sleep(SLEEP_MS);
```

Find the main season loop (inside leaderboard fetch loop) around line 113. Change:
```typescript
await sleep(55);
```
to:
```typescript
await sleep(SLEEP_MS);
```

- [ ] **Step 3: Verify changes**

Run: `grep -n "sleep(55)" scripts/fetch/index.ts`
Expected: No output (all replaced)

Run: `grep -n "SLEEP_MS" scripts/fetch/index.ts`
Expected: 3 matches (1 definition, 2 usages)

- [ ] **Step 4: Commit**

```bash
git add scripts/fetch/index.ts
git commit -m "⚙️ Reduce API sleep from 55ms to 35ms for parallel fetching"
```

---

## Task 2: Define Return Type and Extract `processSeason()` Function

**Files:**
- Modify: `scripts/fetch/index.ts`

- [ ] **Step 1: Add return type definition**

Before the `main()` function (after imports and helper functions, around line 40), add:

```typescript
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
```

- [ ] **Step 2: Extract season processing into `processSeason()` function**

Add this function before `main()`. This extracts the logic from the current sequential loop (lines 64-140):

```typescript
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
```

- [ ] **Step 3: Verify function compiles**

Run: `npm run build 2>&1 | head -30`
Expected: No TypeScript errors related to `processSeason` or `ProcessSeasonResult`

- [ ] **Step 4: Commit**

```bash
git add scripts/fetch/index.ts
git commit -m "refactor: extract processSeason() function for parallel execution"
```

---

## Task 3: Replace Sequential Loop with Batching Logic

**Files:**
- Modify: `scripts/fetch/index.ts` (main function)

- [ ] **Step 1: Replace the sequential season loop**

In the `main()` function, find and delete the old sequential loop starting at line 64:
```typescript
for (const seasonId of seasonIds) {
    const season = await fetchSeason(token, seasonId);
    // ... rest of loop
}
```

Replace it with this batching logic:

```typescript
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
```

- [ ] **Step 2: Verify batching logic compiles**

Run: `npm run build 2>&1 | head -30`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add scripts/fetch/index.ts
git commit -m "✨ Implement parallel season fetching with 3-season batches"
```

---

## Task 4: Merge Season Metadata and Build Final Manifests

**Files:**
- Modify: `scripts/fetch/index.ts` (main function, after batching loop)

- [ ] **Step 1: Build manifest data from results**

After the batching loop (after all `seasonResults` are collected), add:

```typescript
  // Build season list and affix manifest from successful results
  const seasons: SeasonMeta[] = [];
  const affixManifest: AffixManifest = {};

  for (const result of seasonResults) {
    if (result.success) {
      seasons.push(result.seasonMeta);

      // Merge affix data: seasonId → periodId → affixes
      if (!affixManifest[result.seasonId]) {
        affixManifest[result.seasonId] = {};
      }
      for (const [periodId, affixes] of Object.entries(result.affixData)) {
        affixManifest[result.seasonId][periodId] = affixes;
      }
    }
  }
```

- [ ] **Step 2: Write manifests**

Keep the existing code that writes the manifests (should be unchanged):

```typescript
  const manifest: DungeonManifest = {
    dungeons: Array.from(dungeonMap.values()),
    seasons,
    zones: [],
  };

  await writeManifest(manifest);
  console.log('\nWritten public/data/dungeons.json');

  await writeAffixManifest(affixManifest);
  console.log('Written public/data/affixes.json');
```

- [ ] **Step 3: Verify compiles**

Run: `npm run build 2>&1 | head -30`
Expected: No TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add scripts/fetch/index.ts
git commit -m "refactor: build manifests from parallel season results"
```

---

## Task 5: Add Failure Reporting

**Files:**
- Modify: `scripts/fetch/index.ts` (main function, before final success message)

- [ ] **Step 1: Add failure reporting at the end**

Before the final "Done" message, add:

```typescript
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
      console.log(`\n✅ ${seasons.length}/${seasonIds.length} seasons succeeded. Re-run fetch to retry failed seasons.`);
    }
  }
```

Keep the existing final message unchanged:
```typescript
  console.log('\nDone. Remember to manually fill era, mapX, mapY, offWorld in dungeons.json.');
```

- [ ] **Step 2: Verify the change**

Run: `npm run build 2>&1 | head -30`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add scripts/fetch/index.ts
git commit -m "📋 Add failure reporting for parallel season processing"
```

---

## Task 6: Verify Parallel Execution Locally

**Files:**
- Test: `scripts/fetch/index.ts` (manual testing)

- [ ] **Step 1: Start a fetch run**

Set your Blizzard API credentials in `.env` if not already set:
```bash
export VITE_BLIZZARD_CLIENT_ID="your_id"
export VITE_BLIZZARD_CLIENT_SECRET="your_secret"
```

Run: `npm run fetch 2>&1 | tee fetch-run.log`

This will run the fetch pipeline. Watch the console output.

- [ ] **Step 2: Verify parallel batching in logs**

While fetch runs, look for lines like:
```
📦 Processing batch: 1, 2, 3
  Processing season 1: ...
  Processing season 2: ...
  Processing season 3: ...
```

Expected: Timestamps should show seasons starting within ~1-2 seconds of each other (parallel), not 30+ minutes apart (sequential).

- [ ] **Step 3: Verify all parquet files created**

Run: `ls -lh public/data/season-*.parquet | wc -l`
Expected: 15 files (or fewer if some seasons have no data)

Check file sizes:
```bash
ls -lh public/data/season-*.parquet | awk '{print $5, $9}'
```
Expected: Consistent sizes (2-5K range, no files that are too small like <100 bytes)

- [ ] **Step 4: Verify manifest files**

Run: `jq '.seasons | length' public/data/dungeons.json`
Expected: Should match number of successful seasons

Run: `jq 'keys | length' public/data/affixes.json`
Expected: Should match number of seasons fetched

- [ ] **Step 5: No commit needed**

This is a manual verification step. If the run was successful, move to next task. If there are errors, check the logs and debug before proceeding.

---

## Task 7: Test Failure Handling (Optional but Recommended)

**Files:**
- Test: Manual test of failure scenario

- [ ] **Step 1: Simulate a failed season (optional)**

This test is optional — you can skip it if confident in error handling. To test:

Temporarily modify `processSeason()` to fail for a specific season:

```typescript
// Add this after the try line in processSeason:
if (seasonId === 5) {
  throw new Error('Simulated failure for testing');
}
```

- [ ] **Step 2: Run fetch again**

Run: `npm run fetch 2>&1 | tail -20`

Expected output should include:
```
⚠️  Failed seasons:
   Season 5: Simulated failure for testing

✅ 14/15 seasons succeeded. Re-run fetch to retry failed seasons.
```

Exit code should be 0 (success, since not all seasons failed).

- [ ] **Step 3: Revert test change**

Remove the test code you added in Step 1.

Run: `git checkout scripts/fetch/index.ts`

- [ ] **Step 4: No commit for this task**

This was a manual test verification.

---

## Summary

After all tasks complete:

- ✅ Sleep reduced from 55ms to 35ms
- ✅ `processSeason()` function extracted for reusability
- ✅ Batching logic implemented with `Promise.allSettled()`
- ✅ Parallel execution of 3 seasons per batch
- ✅ Manifest merging from all successful seasons
- ✅ Failure reporting (skip failed seasons, report at end)
- ✅ Exit code 1 only if all seasons fail
- ✅ Expected runtime reduction to ~2-3 hours from ~7 hours
