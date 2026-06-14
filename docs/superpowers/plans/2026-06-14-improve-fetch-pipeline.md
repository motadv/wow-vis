# Improve Fetch Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical bugs in the data fetch script that cause "Cannot read properties of undefined" crashes, add affix data collection for the design spec, and optimize to skip empty periods and avoid unnecessary API calls.

**Architecture:** The fetch pipeline has two issues: (1) it discovers active periods but still tries to fetch all periods, wasting API calls and hitting incomplete responses; (2) it tries to access `keystone_affixes` without null checks, crashing when the API returns incomplete data. We fix this by tracking active periods during discovery, only fetching those, and adding defensive checks for incomplete API responses. We also wire up the existing affix accumulation code to ensure all data paths properly populate affixes.json.

**Tech Stack:** Node.js/TypeScript, Blizzard API, DuckDB

---

## File Structure

| File | Responsibility |
|------|-----------------|
| `scripts/fetch/index.ts` | Main orchestration loop; will be refactored to track active periods and skip empty ones |
| `scripts/fetch/blizzard.ts` | API calls; already correct, no changes needed |
| `scripts/fetch/transform.ts` | Leaderboard transformation; already handles `fortified` derivation, no changes needed |
| `scripts/fetch/types.ts` | Type definitions; already has AffixEntry and AffixManifest, no changes needed |
| `scripts/fetch/write.ts` | File writing; already has writeAffixManifest, no changes needed |

---

## Task 1: Track Active Periods During Discovery

**Files:**
- Modify: `scripts/fetch/index.ts:14–39` (discoverActiveDungeons function)

When discovering active dungeons, we're already trying each period until one has data. Instead of discarding which period worked, return it so the main loop only fetches that period for all dungeons/realms.

- [ ] **Step 1: Update discoverActiveDungeons return type and logic**

Change the function signature to return both the active dungeon IDs and the period ID that had data. Update the function to return the period ID alongside the dungeon list:

```typescript
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
    console.log(`    Period ${periodId} returned no data, trying next period...`);
  }
  return { dungeonIds: [], activePeriodId: null };
}
```

- [ ] **Step 2: Update the call site to use the new return structure**

In the main loop (around line 76–79), update to:

```typescript
console.log(`  Discovering active dungeons across ${periods.length} periods on realm ${realmIds[0]}...`);
const { dungeonIds: activeDungeonIds, activePeriodId } = await discoverActiveDungeons(
  token, allDungeonIds, periods, realmIds[0],
);
console.log(`  Active dungeons: ${activeDungeonIds.join(', ')} (period ${activePeriodId})`);
```

- [ ] **Step 3: Only fetch the active period, not all periods**

Replace the triple-nested loop (lines 104–128) with one that only iterates the active period:

```typescript
if (activePeriodId === null) {
  console.log(`  No active period found for season ${seasonId}; skipping leaderboard fetch`);
} else {
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
}
```

- [ ] **Step 4: Commit**

```bash
git add scripts/fetch/index.ts
git commit -m "♻️ Track active periods during discovery, skip empty periods"
```

---

## Task 2: Add Defensive Null Checks for Incomplete API Responses

**Files:**
- Modify: `scripts/fetch/index.ts:114–122` (affix accumulation) — already done in Task 1 above
- Modify: `scripts/fetch/transform.ts:8` (fortified derivation)

The transform function assumes `keystone_affixes` exists. Add a defensive check:

- [ ] **Step 1: Update transformLeaderboard to handle missing keystone_affixes**

```typescript
export function transformLeaderboard(
  raw: BlizzardLeaderboard,
  seasonId: number,
  realmId: number,
): LeaderboardEntry[] {
  const affixes = raw.keystone_affixes ?? [];
  const fortified = affixes.some(affix => affix.keystone_affix.id === 10);
  return raw.leading_groups.map(group => ({
    dungeon_id: raw.map_challenge_mode_id,
    season_id: seasonId,
    period: raw.period,
    realm_id: realmId,
    keystone_level: group.keystone_level,
    duration_ms: group.duration_ms,
    fortified,
  }));
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/fetch/transform.ts
git commit -m "🛡️ Add defensive null check for keystone_affixes"
```

---

## Task 3: Improve Error Messages and Logging

**Files:**
- Modify: `scripts/fetch/index.ts:36, 72, 75, 130` (log statements)

Make it clearer what's happening, especially when periods are skipped.

- [ ] **Step 1: Update logging in discoverActiveDungeons**

Change line 36 from:
```typescript
console.log(`    Period ${periodId} returned no data, trying next period...`);
```

To:
```typescript
console.log(`      Period ${periodId} → no active dungeons, trying next...`);
```

- [ ] **Step 2: Update logging when no active period is found**

When activePeriodId is null, add a clear log:

```typescript
if (activePeriodId === null) {
  console.log(`  ⚠️  No active period found across ${periods.length} periods; skipping leaderboard fetch`);
}
```

- [ ] **Step 3: Update collection summary log**

Change line 130 to show period info:

```typescript
console.log(`  Collected ${allEntries.length} entries from period ${activePeriodId} — writing Parquet...`);
```

- [ ] **Step 4: Commit**

```bash
git add scripts/fetch/index.ts
git commit -m "📝 Improve logging clarity for period discovery and skipping"
```

---

## Task 4: Test the Improved Fetch Pipeline

**Files:**
- Test: Run the actual fetch command

- [ ] **Step 1: Run the fetch script and verify no "Cannot read properties" errors**

```bash
npm run fetch 2>&1 | tee fetch-log.txt
```

Expected output: Should process all seasons without "Cannot read properties of undefined" errors. You should see period discovery messages like "Period 661 → no active dungeons, trying next..." and only one period per season attempted for leaderboard fetching.

- [ ] **Step 2: Verify affixes.json was written**

```bash
cat public/data/affixes.json | head -20
```

Expected output: JSON structure with season IDs as keys, period IDs nested, and affix arrays. Example:
```json
{
  "6": {
    "456": [
      { "id": 10, "name": "Fortified" },
      { "id": 11, "name": "Bursting" }
    ]
  }
}
```

- [ ] **Step 3: Verify Parquet files have fortified column**

Run a quick DuckDB query to check:

```bash
node -e "
import('duckdb').then(async m => {
  const db = new m.default.Database(':memory:');
  db.run(
    'SELECT column_name FROM information_schema.columns WHERE table_name = \\'season_6\\' ORDER BY ordinal_position',
    (err, res) => {
      if (err) console.error(err);
      else console.log(res);
      db.close();
    }
  );
});
" --input-type=module
```

Or manually inspect via browser console once the viz loads and you query season 6.

- [ ] **Step 4: Commit**

```bash
git add fetch-log.txt  # if you want to keep it for reference, otherwise skip this
git commit -m "✅ Verify fetch pipeline improvements — no errors, affixes.json written, fortified column present"
```

---

## Spec Coverage Check

- ✅ **Data Pipeline Changes**: Fortified boolean derivation (in transform.ts already), affix manifest collection and writing (in index.ts, now with defensive checks)
- ✅ **Bug fixes**: Period discovery now skips empty periods, no more "Cannot read properties of undefined" crashes
- ✅ **Efficiency**: Only fetches active period per season, not all periods
- ✅ **Types**: AffixEntry and AffixManifest already defined in types.ts

---

## Next Steps

After completing these tasks:
1. The browser viz can load `affixes.json` alongside `dungeons.json` in `src/db/init.ts`
2. Implement the three affix analysis chart lenses as per the design spec
3. Wire up state changes to query the new affix data functions (to be added to `src/db/queries.ts`)
