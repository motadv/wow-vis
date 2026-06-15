# Parallel Season Fetching Design

**Date:** 2026-06-14  
**Status:** Design approved, ready for implementation

## Problem

The current fetch pipeline processes seasons sequentially (season 1 → season 2 → ... → season 15). With 15 seasons and an average of 30+ minutes per season, total runtime is roughly 7+ hours. The bottleneck is waiting for one season to complete before starting the next.

The 55ms sleep between API requests prevents rate limiting, but accumulates across all requests. Parallelizing season fetches can reduce total time to roughly 2–3 hours (1/5th of sequential time).

## Solution

Run 2–3 seasons in parallel using `Promise.allSettled()`, reducing idle time while maintaining API safety with a reduced 35ms sleep between requests.

## Architecture

### High-Level Flow

```
Fetch season IDs
  ↓
Fetch all dungeons (once, shared)
  ↓
Batch seasons into groups of 2–3
  ↓
For each batch in parallel:
  - processSeason() for each season
    - Discover active dungeons
    - Fetch leaderboard data (realms × periods × dungeons)
    - Write parquet file
    - Return dungeon metadata + affix data
  ↓
Merge dungeon/affix manifests from all seasons
  ↓
Write dungeons.json + affixes.json
  ↓
Report results (succeeded/failed seasons)
```

### Concurrency Control

- **Concurrency limit:** 2–3 seasons at a time
- **Implementation:** Batch seasons into groups, use `Promise.allSettled()` per batch, wait for batch completion before starting next
- **Sleep adjustment:** Reduce from 55ms to 35ms to compensate for parallel I/O

### Error Handling

- Failed seasons are skipped (caught in `Promise.allSettled()`)
- Collect failures in a list and report at the end with error messages
- Exit code 1 only if **all** seasons fail; partial success is acceptable

## Implementation

### Files to Modify

1. **`scripts/fetch/index.ts`**
   - Extract season processing loop into `processSeason(token, seasonId, allDungeonIds, dungeonNameById, realmIds)` function
   - Return type: `{ seasonId: number, dungeonMap: Map<number, DungeonMeta>, affixData: AffixManifest[seasonId], success: true } | { seasonId: number, error: string, success: false }`
   - Replace sequential loop with batching logic:
     ```typescript
     const batchSize = 3; // Fetch 3 seasons in parallel per batch
     const failed: Array<{ seasonId: number, error: string }> = [];
     
     for (let i = 0; i < seasonIds.length; i += batchSize) {
       const batch = seasonIds.slice(i, i + batchSize);
       const results = await Promise.allSettled(
         batch.map(id => processSeason(...))
       );
       
       // Process results, merge into manifests, collect failures
     }
     ```
   - Merge dungeon/affix data from all successful seasons
   - Report failures at the end

2. **`scripts/fetch/blizzard.ts`**
   - Change sleep from 55ms to 35ms (one location in `fetchLeaderboard` call site or create a constant)

3. **`scripts/fetch/write.ts`**
   - No changes (each season writes to its own parquet file, no concurrency issues)

### Data Structures

**Return type from `processSeason()`:**

```typescript
type ProcessSeasonResult = 
  | { success: true; seasonId: number; dungeonMap: Map<number, DungeonMeta>; affixData: Record<number, AffixData[]> }
  | { success: false; seasonId: number; error: string };
```

**Final manifest merge:**
- Merge all `dungeonMap` entries across successful seasons into a single `Map<number, DungeonMeta>`
- Merge all `affixData` into a single `AffixManifest` object
- Write as usual to `dungeons.json` and `affixes.json`

## Testing

- Verify that 2–3 seasons run concurrently (inspect logs, check timestamps)
- Verify that all successful seasons produce correct parquet files
- Verify that manifest merging combines all dungeons/affixes correctly
- Test failure case: mock a season fetch to fail, verify it's skipped and reported

## Success Criteria

- Total runtime reduced to ~2–3 hours (from ~7 hours)
- All 15 seasons fetched and written (or failures clearly reported)
- No API rate limiting errors
- Manifest files contain correct merged data
