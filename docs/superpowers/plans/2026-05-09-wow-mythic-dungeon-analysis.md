# WoW Mythic+ Dungeon Analysis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive dashboard that visualizes how dungeon era of origin and reintroduction history shape high-end Mythic+ player adoption across seasons, rendered on top of the Azeroth world map.

**Architecture:** An offline Node.js fetch script pulls Blizzard Mythic+ leaderboard data for a sample of connected realms, writes per-season Parquet files and a `dungeons.json` manifest to `public/data/`. At runtime, DuckDB-Wasm loads these files on demand and executes aggregation queries; D3.js renders a zoomable world map with dungeon nodes, a season scrubber, a filter bar, and a detail panel with Era and Reintroduction views.

**Tech Stack:** Vite + TypeScript, D3.js v7, @duckdb/duckdb-wasm, Tailwind CSS (CDN), Node.js 18+ with native `duckdb` and `tsx` for the offline script, Vitest for unit tests.

---

## File Map

### New files
| Path | Responsibility |
|---|---|
| `vite.config.ts` | COOP/COEP headers + exclude DuckDB-Wasm from pre-bundling |
| `scripts/tsconfig.json` | TypeScript config for Node.js scripts |
| `scripts/fetch/types.ts` | Shared types for the fetch pipeline |
| `scripts/fetch/auth.ts` | Blizzard OAuth client credentials flow |
| `scripts/fetch/auth.test.ts` | Unit tests for auth |
| `scripts/fetch/blizzard.ts` | Typed wrappers for Blizzard API endpoints |
| `scripts/fetch/transform.ts` | Transform raw API responses to our schema |
| `scripts/fetch/transform.test.ts` | Unit tests for transform |
| `scripts/fetch/write.ts` | Write Parquet + manifest via native duckdb |
| `scripts/fetch/index.ts` | CLI orchestrator |
| `src/types.ts` | Shared types for the viz layer |
| `src/state.ts` | Two-variable reactive state (selectedSeason, selectedDungeon) |
| `src/db/queries.ts` | Typed DuckDB-Wasm query functions |
| `src/charts/map.ts` | World map SVG + dungeon nodes |
| `src/charts/scrubber.ts` | Season timeline scrubber |
| `src/charts/filters.ts` | Global filter bar + view mode toggle |
| `src/charts/detail/index.ts` | Detail panel shell (tab switcher, dungeon header) |
| `src/charts/detail/era.ts` | Era view — Question A bar chart |
| `src/charts/detail/reintroduction.ts` | Reintroduction view — Question B small multiples |

### Modified files
| Path | Changes |
|---|---|
| `package.json` | Add tsx, duckdb, vitest devDeps; add fetch/test scripts |
| `index.html` | Full dashboard layout |
| `src/config.ts` | Era palette, map dimensions, off-world anchor |
| `src/db/init.ts` | Implement DuckDB-Wasm init and per-season Parquet loader |
| `src/charts/init.ts` | Orchestrate all chart inits and data flow |
| `src/main.ts` | Call initViz(), remove placeholder D3 code |

### Manual assets (team must provide before running the viz)
| Path | How |
|---|---|
| `public/map.png` | Download high-res Azeroth world map from WoW Wiki |
| `public/data/dungeons.json` | Run `npm run fetch` to generate template, then manually set `era`, `mapX`, `mapY`, `offWorld` for each dungeon entry |

---

## Task 1: Project Setup

**Files:**
- Modify: `package.json`
- Create: `vite.config.ts`
- Create: `scripts/tsconfig.json`

- [ ] **Step 1: Update package.json**

Replace the existing `scripts` and `devDependencies` with:

```json
{
  "name": "wow-vis",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "fetch": "tsx scripts/fetch/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@types/d3": "^7.4.3",
    "@types/node": "^22.0.0",
    "duckdb": "^1.1.0",
    "tsx": "^4.19.0",
    "typescript": "~6.0.2",
    "vite": "^8.0.10",
    "vitest": "^3.0.0"
  },
  "dependencies": {
    "@duckdb/duckdb-wasm": "^1.33.1-dev45.0",
    "d3": "^7.9.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install
```

Expected: no errors; `node_modules/duckdb`, `node_modules/tsx`, `node_modules/vitest` appear.

- [ ] **Step 3: Create vite.config.ts**

DuckDB-Wasm uses SharedArrayBuffer, which requires these security headers. Vite must also not pre-bundle DuckDB-Wasm (it ships its own worker).

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    exclude: ['@duckdb/duckdb-wasm'],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
```

- [ ] **Step 4: Create scripts/tsconfig.json**

The root tsconfig uses `moduleResolution: bundler` (Vite-specific). Scripts run in Node.js and need `node16` resolution.

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "moduleResolution": "node16",
    "module": "node16",
    "target": "es2022",
    "noEmit": false,
    "allowImportingTsExtensions": false,
    "types": ["node"]
  },
  "include": ["."]
}
```

- [ ] **Step 5: Type-check both contexts**

```bash
npx tsc --project tsconfig.json --noEmit
npx tsc --project scripts/tsconfig.json --noEmit
```

Expected: no errors (scripts/ is empty at this point).

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts scripts/tsconfig.json package.json package-lock.json
git commit -m "⚙️ Add vitest, tsx, duckdb; vite config for DuckDB-Wasm"
```

---

## Task 2: Shared Types

**Files:**
- Create: `scripts/fetch/types.ts`
- Create: `src/types.ts`

- [ ] **Step 1: Create scripts/fetch/types.ts**

```typescript
export type Era =
  | 'vanilla' | 'tbc' | 'wotlk' | 'cata' | 'mop' | 'wod'
  | 'legion' | 'bfa' | 'shadowlands' | 'dragonflight' | 'tww';

export interface DungeonMeta {
  id: number;
  name: string;
  era: Era;
  mapX: number;
  mapY: number;
  offWorld: boolean;
  seasons: number[];
}

export interface SeasonMeta {
  id: number;
  name: string;
  startTimestamp: number;
  endTimestamp: number;
  dungeonIds: number[];
}

export interface DungeonManifest {
  dungeons: DungeonMeta[];
  seasons: SeasonMeta[];
}

export interface LeaderboardEntry {
  dungeon_id: number;
  season_id: number;
  period: number;
  realm_id: number;
  keystone_level: number;
  duration_ms: number;
}

// Raw Blizzard API shapes
export interface BlizzardSeason {
  id: number;
  dungeons: Array<{ id: number; name: string }>;
  start_timestamp: number;
  end_timestamp: number | null;
}

export interface BlizzardLeaderboardGroup {
  duration: number;
  keystone_level: number;
}

export interface BlizzardLeaderboard {
  dungeon: { id: number };
  period: number;
  leading_groups: BlizzardLeaderboardGroup[];
}
```

- [ ] **Step 2: Create src/types.ts**

```typescript
export type Era =
  | 'vanilla' | 'tbc' | 'wotlk' | 'cata' | 'mop' | 'wod'
  | 'legion' | 'bfa' | 'shadowlands' | 'dragonflight' | 'tww';

export interface DungeonMeta {
  id: number;
  name: string;
  era: Era;
  mapX: number;
  mapY: number;
  offWorld: boolean;
  seasons: number[];
}

export interface SeasonMeta {
  id: number;
  name: string;
  startTimestamp: number;
  endTimestamp: number;
  dungeonIds: number[];
}

export interface DungeonManifest {
  dungeons: DungeonMeta[];
  seasons: SeasonMeta[];
}

export interface VolumeRow {
  dungeonId: number;
  entryCount: number;
  minKey: number;
  medianKey: number;
  maxKey: number;
}

export interface KeyDistRow {
  keystoneLevel: number;
  count: number;
}

export interface CrossSeasonRow {
  seasonId: number;
  entryCount: number;
  medianKey: number;
  maxKey: number;
}

export interface AppState {
  selectedSeason: number;
  selectedDungeon: number | null;
  viewMode: 'era' | 'reintroduction';
  filterEras: Era[];
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --project tsconfig.json --noEmit
npx tsc --project scripts/tsconfig.json --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add scripts/fetch/types.ts src/types.ts
git commit -m "🏗️ Add shared types for pipeline and viz layers"
```

---

## Task 3: Dashboard HTML Layout

**Files:**
- Modify: `index.html`
- Modify: `src/style.css`
- Modify: `src/main.ts`

- [ ] **Step 1: Replace index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WoW M+ Dungeon Analysis</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script type="module" src="/src/main.ts"></script>
  </head>
  <body class="bg-gray-900 text-gray-100 h-screen flex flex-col overflow-hidden">
    <div id="filters" class="flex-none px-4 py-2 bg-gray-800 border-b border-gray-700 min-h-10"></div>
    <div class="flex flex-1 overflow-hidden">
      <div id="map" class="flex-1 relative overflow-hidden"></div>
      <div id="detail" class="w-96 flex-none bg-gray-800 border-l border-gray-700 overflow-y-auto hidden"></div>
    </div>
    <div id="scrubber" class="flex-none px-4 py-3 bg-gray-800 border-t border-gray-700 min-h-12"></div>
  </body>
</html>
```

- [ ] **Step 2: Replace src/style.css**

```css
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; }
```

- [ ] **Step 3: Replace src/main.ts with the final version**

```typescript
import initViz from './charts/init';

initViz().catch((err: unknown) => {
  console.error('Visualization init failed:', err);
  const map = document.getElementById('map');
  if (map) map.textContent = 'Failed to load. Check console.';
});
```

- [ ] **Step 4: Smoke test**

```bash
npm run dev
```

Open the printed URL. Expected: dark gray page with four empty sections, no console errors.

- [ ] **Step 5: Commit**

```bash
git add index.html src/style.css src/main.ts
git commit -m "🎨 Add dashboard HTML layout"
```

---

## Task 4: Blizzard Auth

**Files:**
- Create: `scripts/fetch/auth.ts`
- Create: `scripts/fetch/auth.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// scripts/fetch/auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchToken } from './auth.ts';

describe('fetchToken', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns access_token on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'test-token', expires_in: 86400 }),
    } as Response);

    const token = await fetchToken('my-id', 'my-secret');
    expect(token).toBe('test-token');
  });

  it('throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    } as Response);

    await expect(fetchToken('id', 'secret')).rejects.toThrow('Blizzard auth failed: 401');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run scripts/fetch/auth.test.ts
```

Expected: FAIL — `fetchToken` not defined.

- [ ] **Step 3: Implement scripts/fetch/auth.ts**

```typescript
// scripts/fetch/auth.ts
const TOKEN_URL = 'https://oauth.battle.net/token';

export async function fetchToken(clientId: string, clientSecret: string): Promise<string> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) throw new Error(`Blizzard auth failed: ${res.status}`);

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx vitest run scripts/fetch/auth.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch/auth.ts scripts/fetch/auth.test.ts
git commit -m "✅ Add Blizzard OAuth auth with tests"
```

---

## Task 5: Blizzard API Client

**Files:**
- Create: `scripts/fetch/blizzard.ts`

These are thin HTTP wrappers verified by running the full fetch in Task 7, not by unit tests.

- [ ] **Step 1: Create scripts/fetch/blizzard.ts**

```typescript
// scripts/fetch/blizzard.ts
import type { BlizzardSeason, BlizzardLeaderboard } from './types.ts';

const BASE = 'https://us.api.blizzard.com';
const NS = 'dynamic-us';

async function get<T>(path: string, token: string): Promise<T> {
  const url = `${BASE}${path}?namespace=${NS}&locale=en_US`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export async function fetchSeasonIds(token: string): Promise<number[]> {
  const data = await get<{ seasons: Array<{ id: number }> }>(
    '/data/wow/mythic-keystone/season/index', token,
  );
  return data.seasons.map((s) => s.id);
}

export async function fetchSeason(seasonId: number, token: string): Promise<BlizzardSeason> {
  return get<BlizzardSeason>(`/data/wow/mythic-keystone/season/${seasonId}`, token);
}

export async function fetchPeriodIds(token: string): Promise<number[]> {
  const data = await get<{ periods: Array<{ id: number }> }>(
    '/data/wow/mythic-keystone/period/index', token,
  );
  return data.periods.map((p) => p.id);
}

export async function fetchLeaderboard(
  realmId: number,
  dungeonId: number,
  periodId: number,
  token: string,
): Promise<BlizzardLeaderboard> {
  return get<BlizzardLeaderboard>(
    `/data/wow/connected-realm/${realmId}/mythic-leaderboard/${dungeonId}/period/${periodId}`,
    token,
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --project scripts/tsconfig.json --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/fetch/blizzard.ts
git commit -m "🌐 Add Blizzard API client wrappers"
```

---

## Task 6: Data Transformation

**Files:**
- Create: `scripts/fetch/transform.ts`
- Create: `scripts/fetch/transform.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// scripts/fetch/transform.test.ts
import { describe, it, expect } from 'vitest';
import { transformLeaderboard } from './transform.ts';
import type { BlizzardLeaderboard } from './types.ts';

describe('transformLeaderboard', () => {
  it('maps leading_groups to LeaderboardEntry array', () => {
    const raw: BlizzardLeaderboard = {
      dungeon: { id: 234 },
      period: 850,
      leading_groups: [
        { duration: 1800000, keystone_level: 20 },
        { duration: 2100000, keystone_level: 18 },
      ],
    };

    const result = transformLeaderboard(raw, 1, 57);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      dungeon_id: 234,
      season_id: 1,
      period: 850,
      realm_id: 57,
      keystone_level: 20,
      duration_ms: 1800000,
    });
    expect(result[1].keystone_level).toBe(18);
  });

  it('returns empty array when leading_groups is empty', () => {
    const raw: BlizzardLeaderboard = {
      dungeon: { id: 1 },
      period: 1,
      leading_groups: [],
    };
    expect(transformLeaderboard(raw, 1, 1)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npx vitest run scripts/fetch/transform.test.ts
```

Expected: FAIL — `transformLeaderboard` not defined.

- [ ] **Step 3: Implement scripts/fetch/transform.ts**

```typescript
// scripts/fetch/transform.ts
import type { BlizzardLeaderboard, LeaderboardEntry } from './types.ts';

export function transformLeaderboard(
  raw: BlizzardLeaderboard,
  seasonId: number,
  realmId: number,
): LeaderboardEntry[] {
  return raw.leading_groups.map((g) => ({
    dungeon_id: raw.dungeon.id,
    season_id: seasonId,
    period: raw.period,
    realm_id: realmId,
    keystone_level: g.keystone_level,
    duration_ms: g.duration,
  }));
}
```

- [ ] **Step 4: Run to confirm it passes**

```bash
npx vitest run scripts/fetch/transform.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch/transform.ts scripts/fetch/transform.test.ts
git commit -m "✅ Add leaderboard transformer with tests"
```

---

## Task 7: Parquet Writer + Fetch Orchestrator

**Files:**
- Create: `scripts/fetch/write.ts`
- Create: `scripts/fetch/index.ts`

- [ ] **Step 1: Create scripts/fetch/write.ts**

Uses native `duckdb` Node.js package. Writes entries as NDJSON to a temp file, then converts to Parquet via DuckDB — this avoids large SQL string concatenation.

```typescript
// scripts/fetch/write.ts
import { default as Database } from 'duckdb';
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { LeaderboardEntry, DungeonManifest } from './types.ts';

const OUT_DIR = join(process.cwd(), 'public/data');

export async function ensureOutDir(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
}

export async function writeParquet(seasonId: number, entries: LeaderboardEntry[]): Promise<void> {
  if (entries.length === 0) return;

  const tmpPath = join(tmpdir(), `season-${seasonId}-${Date.now()}.ndjson`);
  const ndjson = entries.map((e) => JSON.stringify(e)).join('\n');
  await writeFile(tmpPath, ndjson, 'utf8');

  const outPath = join(OUT_DIR, `season-${seasonId}.parquet`);
  const db = new Database.Database(':memory:');
  const conn = db.connect();

  await new Promise<void>((resolve, reject) => {
    conn.run(
      `COPY (SELECT * FROM read_ndjson_auto('${tmpPath}')) TO '${outPath}' (FORMAT PARQUET)`,
      (err) => (err ? reject(err) : resolve()),
    );
  });

  conn.close();
  db.close();
  await unlink(tmpPath);
  console.log(`  ✓ season-${seasonId}.parquet (${entries.length} entries)`);
}

export async function writeManifest(manifest: DungeonManifest): Promise<void> {
  const outPath = join(OUT_DIR, 'dungeons.json');
  await writeFile(outPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`  ✓ dungeons.json (${manifest.dungeons.length} dungeons, ${manifest.seasons.length} seasons)`);
}
```

- [ ] **Step 2: Create scripts/fetch/index.ts**

```typescript
// scripts/fetch/index.ts
import { fetchToken } from './auth.ts';
import { fetchSeasonIds, fetchSeason, fetchPeriodIds, fetchLeaderboard } from './blizzard.ts';
import { transformLeaderboard } from './transform.ts';
import { ensureOutDir, writeParquet, writeManifest } from './write.ts';
import type { LeaderboardEntry, DungeonManifest, DungeonMeta, SeasonMeta } from './types.ts';

// US connected realm IDs to sample. Find valid IDs at:
// https://us.api.blizzard.com/data/wow/connected-realm/index?namespace=dynamic-us
// These four cover high-population PvE and PvP realms.
const SAMPLE_REALM_IDS = [57, 58, 59, 4];

const CLIENT_ID = process.env['VITE_BLIZZARD_CLIENT_ID'] ?? '';
const CLIENT_SECRET = process.env['VITE_BLIZZARD_CLIENT_SECRET'] ?? '';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Set VITE_BLIZZARD_CLIENT_ID and VITE_BLIZZARD_CLIENT_SECRET in .env');
  }

  await ensureOutDir();

  console.log('Authenticating...');
  const token = await fetchToken(CLIENT_ID, CLIENT_SECRET);

  console.log('Fetching indexes...');
  const allSeasonIds = await fetchSeasonIds(token);
  const allPeriodIds = await fetchPeriodIds(token);

  const seasons: SeasonMeta[] = [];
  const dungeonMap = new Map<number, DungeonMeta>();

  for (const seasonId of allSeasonIds) {
    console.log(`\nSeason ${seasonId}:`);
    const season = await fetchSeason(seasonId, token);

    // Skip the current incomplete season (no end_timestamp or future end)
    if (!season.end_timestamp || season.end_timestamp > Date.now()) {
      console.log('  Skipping (current/incomplete)');
      continue;
    }

    const dungeonIds = season.dungeons.map((d) => d.id);
    seasons.push({
      id: seasonId,
      name: `Season ${seasonId}`,
      startTimestamp: season.start_timestamp,
      endTimestamp: season.end_timestamp,
      dungeonIds,
    });

    for (const d of season.dungeons) {
      if (!dungeonMap.has(d.id)) {
        // era, mapX, mapY, offWorld are placeholders — must be set manually in dungeons.json
        dungeonMap.set(d.id, {
          id: d.id,
          name: d.name,
          era: 'vanilla',
          mapX: 0,
          mapY: 0,
          offWorld: false,
          seasons: [],
        });
      }
      dungeonMap.get(d.id)!.seasons.push(seasonId);
    }

    const entries: LeaderboardEntry[] = [];
    for (const dungeonId of dungeonIds) {
      for (const realmId of SAMPLE_REALM_IDS) {
        for (const periodId of allPeriodIds) {
          try {
            const lb = await fetchLeaderboard(realmId, dungeonId, periodId, token);
            entries.push(...transformLeaderboard(lb, seasonId, realmId));
          } catch {
            // Period may not exist for this dungeon/season — silently skip
          }
          await sleep(55); // ~18 req/s, safely within the 36 000/hr limit
        }
      }
    }

    await writeParquet(seasonId, entries);
  }

  const manifest: DungeonManifest = {
    dungeons: Array.from(dungeonMap.values()),
    seasons,
  };
  await writeManifest(manifest);

  console.log('\nDone. Open public/data/dungeons.json and manually set:');
  console.log('  era, mapX, mapY, offWorld — for each dungeon entry.');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Type-check the scripts**

```bash
npx tsc --project scripts/tsconfig.json --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run the fetch (requires internet + valid .env)**

```bash
npm run fetch
```

This will take many minutes due to rate limiting. Expected outputs in `public/data/`:
- `season-1.parquet`, `season-2.parquet`, … (one per completed season)
- `dungeons.json` with placeholder `era: "vanilla"`, `mapX: 0`, `mapY: 0`

- [ ] **Step 5: Manually fill in dungeons.json**

Open `public/data/dungeons.json`. For each dungeon entry:
- `era`: one of `"vanilla" | "tbc" | "wotlk" | "cata" | "mop" | "wod" | "legion" | "bfa" | "shadowlands" | "dragonflight" | "tww"`
- `mapX` / `mapY`: pixel coordinates on `public/map.png` (open the PNG in an image editor, locate each dungeon's entrance)
- `offWorld`: `true` for dungeons in Argus (Legion), alternate Draenor (WoD), or Shadowlands zones not on the main Azeroth map

- [ ] **Step 6: Commit**

```bash
git add scripts/fetch/write.ts scripts/fetch/index.ts public/data/
git commit -m "📦 Add Parquet writer and fetch orchestrator"
```

---

## Task 8: DuckDB-Wasm Init

**Files:**
- Modify: `src/db/init.ts`

- [ ] **Step 1: Implement src/db/init.ts**

```typescript
// src/db/init.ts
import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

const BUNDLES: duckdb.DuckDBBundles = {
  mvp: { mainModule: duckdb_wasm, mainWorker: mvp_worker },
  eh: { mainModule: duckdb_wasm_eh, mainWorker: eh_worker },
};

let _db: duckdb.AsyncDuckDB | null = null;
let _conn: duckdb.AsyncDuckDBConnection | null = null;
const _loaded = new Set<number>();

export async function initDB(): Promise<void> {
  const bundle = await duckdb.selectBundle(BUNDLES);
  const worker = new Worker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
  _db = await duckdb.createDuckDB(BUNDLES, logger, worker);
  await _db.open({ query: { castBigIntToDouble: true } });
  _conn = await _db.connect();
}

export async function loadSeason(seasonId: number): Promise<void> {
  if (_loaded.has(seasonId) || !_conn) return;
  await _conn.query(
    `CREATE TABLE IF NOT EXISTS leaderboard_${seasonId} AS
     SELECT * FROM read_parquet('/data/season-${seasonId}.parquet')`,
  );
  _loaded.add(seasonId);
}

export function getConnection(): duckdb.AsyncDuckDBConnection {
  if (!_conn) throw new Error('DB not initialized');
  return _conn;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --project tsconfig.json --noEmit
```

Expected: no errors.

- [ ] **Step 3: Smoke test in browser**

Temporarily add to `src/main.ts`:
```typescript
import { initDB, loadSeason } from './db/init';
await initDB();
await loadSeason(1);
console.log('DuckDB OK');
```
Run `npm run dev`, open the URL, check console. Expected: `DuckDB OK` with no errors. If you see COOP/COEP errors, verify `vite.config.ts` is in place from Task 1.

Remove the temporary lines from `src/main.ts` after verifying.

- [ ] **Step 4: Commit**

```bash
git add src/db/init.ts
git commit -m "🦆 Implement DuckDB-Wasm init and Parquet loader"
```

---

## Task 9: Query Functions

**Files:**
- Create: `src/db/queries.ts`

These functions are verified by the browser smoke test in Task 16. DuckDB-Wasm requires a browser Worker environment that Vitest does not provide without significant additional configuration.

- [ ] **Step 1: Create src/db/queries.ts**

```typescript
// src/db/queries.ts
import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import type { VolumeRow, KeyDistRow, CrossSeasonRow } from '../types';

export async function getVolumeRows(
  conn: AsyncDuckDBConnection,
  seasonId: number,
): Promise<VolumeRow[]> {
  const r = await conn.query(`
    SELECT
      dungeon_id             AS dungeonId,
      COUNT(*)               AS entryCount,
      MIN(keystone_level)    AS minKey,
      MEDIAN(keystone_level) AS medianKey,
      MAX(keystone_level)    AS maxKey
    FROM leaderboard_${seasonId}
    GROUP BY dungeon_id
  `);
  return r.toArray().map((row) => ({
    dungeonId: Number(row.dungeonId),
    entryCount: Number(row.entryCount),
    minKey: Number(row.minKey),
    medianKey: Number(row.medianKey),
    maxKey: Number(row.maxKey),
  }));
}

export async function getKeyDistribution(
  conn: AsyncDuckDBConnection,
  seasonId: number,
  dungeonId: number,
): Promise<KeyDistRow[]> {
  const r = await conn.query(`
    SELECT keystone_level AS keystoneLevel, COUNT(*) AS count
    FROM leaderboard_${seasonId}
    WHERE dungeon_id = ${dungeonId}
    GROUP BY keystone_level
    ORDER BY keystone_level
  `);
  return r.toArray().map((row) => ({
    keystoneLevel: Number(row.keystoneLevel),
    count: Number(row.count),
  }));
}

export async function getCrossSeasonVolume(
  conn: AsyncDuckDBConnection,
  dungeonId: number,
  seasonIds: number[],
): Promise<CrossSeasonRow[]> {
  const unioned = seasonIds
    .map(
      (sid) =>
        `SELECT ${sid} AS season_id, keystone_level
         FROM leaderboard_${sid}
         WHERE dungeon_id = ${dungeonId}`,
    )
    .join(' UNION ALL ');

  const r = await conn.query(`
    SELECT
      season_id              AS seasonId,
      COUNT(*)               AS entryCount,
      MEDIAN(keystone_level) AS medianKey,
      MAX(keystone_level)    AS maxKey
    FROM (${unioned})
    GROUP BY season_id
    ORDER BY season_id
  `);
  return r.toArray().map((row) => ({
    seasonId: Number(row.seasonId),
    entryCount: Number(row.entryCount),
    medianKey: Number(row.medianKey),
    maxKey: Number(row.maxKey),
  }));
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --project tsconfig.json --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/db/queries.ts
git commit -m "🔍 Add DuckDB query functions"
```

---

## Task 10: State and Config

**Files:**
- Create: `src/state.ts`
- Modify: `src/config.ts`

- [ ] **Step 1: Create src/state.ts**

```typescript
// src/state.ts
import type { AppState } from './types';

type Listener = (state: Readonly<AppState>) => void;

const _state: AppState = {
  selectedSeason: -1,
  selectedDungeon: null,
  viewMode: 'era',
  filterEras: [],
};
const _listeners: Listener[] = [];

export function getState(): Readonly<AppState> {
  return _state;
}

export function setState(patch: Partial<AppState>): void {
  Object.assign(_state, patch);
  for (const l of _listeners) l(_state);
}

export function subscribe(listener: Listener): () => void {
  _listeners.push(listener);
  return () => {
    const i = _listeners.indexOf(listener);
    if (i >= 0) _listeners.splice(i, 1);
  };
}
```

- [ ] **Step 2: Populate src/config.ts**

```typescript
// src/config.ts
import type { Era } from './types';

export const MAP_WIDTH = 2048;
export const MAP_HEIGHT = 1400;

// Pixel position for the off-world cluster (Argus, alt-Draenor, etc.)
export const OFF_WORLD_X = MAP_WIDTH - 100;
export const OFF_WORLD_Y = 80;

export const ERA_PALETTE: Record<Era, string> = {
  vanilla:      '#8B4513',
  tbc:          '#6A0DAD',
  wotlk:        '#4682B4',
  cata:         '#DC143C',
  mop:          '#2E8B57',
  wod:          '#B8860B',
  legion:       '#9400D3',
  bfa:          '#008080',
  shadowlands:  '#483D8B',
  dragonflight: '#FF6347',
  tww:          '#A0A0A0',
};

export const ERA_LABELS: Record<Era, string> = {
  vanilla:      'Vanilla',
  tbc:          'The Burning Crusade',
  wotlk:        'Wrath of the Lich King',
  cata:         'Cataclysm',
  mop:          'Mists of Pandaria',
  wod:          'Warlords of Draenor',
  legion:       'Legion',
  bfa:          'Battle for Azeroth',
  shadowlands:  'Shadowlands',
  dragonflight: 'Dragonflight',
  tww:          'The War Within',
};

export const ERAS_IN_ORDER: Era[] = [
  'vanilla', 'tbc', 'wotlk', 'cata', 'mop', 'wod',
  'legion', 'bfa', 'shadowlands', 'dragonflight', 'tww',
];
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --project tsconfig.json --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/state.ts src/config.ts
git commit -m "🗂️ Add app state and config"
```

---

## Task 11: World Map + Dungeon Nodes

**Files:**
- Create: `src/charts/map.ts`

- [ ] **Step 1: Create src/charts/map.ts**

```typescript
// src/charts/map.ts
import * as d3 from 'd3';
import type { DungeonManifest, DungeonMeta, VolumeRow } from '../types';
import { ERA_PALETTE, MAP_WIDTH, MAP_HEIGHT, OFF_WORLD_X, OFF_WORLD_Y } from '../config';
import { setState, subscribe, getState } from '../state';

const MIN_R = 6;
const MAX_R = 30;
const rScale = d3.scaleSqrt().range([MIN_R, MAX_R]);

let nodeGroup: d3.Selection<SVGGElement, unknown, HTMLElement, unknown>;
let manifest: DungeonManifest;
let volumeMap = new Map<number, VolumeRow>();

export function initMap(container: HTMLElement, m: DungeonManifest): void {
  manifest = m;

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.4, 5])
    .on('zoom', (e) => inner.attr('transform', e.transform));
  svg.call(zoom);

  const inner = svg.append('g');

  inner
    .append('image')
    .attr('href', '/map.png')
    .attr('width', MAP_WIDTH)
    .attr('height', MAP_HEIGHT);

  // Off-world cluster label
  inner
    .append('text')
    .attr('x', OFF_WORLD_X)
    .attr('y', OFF_WORLD_Y - 14)
    .attr('text-anchor', 'middle')
    .attr('fill', '#9ca3af')
    .style('font-size', '11px')
    .style('font-family', 'sans-serif')
    .text('Off-world');

  nodeGroup = inner.append('g');

  subscribe(() => renderNodes());
}

export function updateVolume(rows: VolumeRow[]): void {
  volumeMap = new Map(rows.map((r) => [r.dungeonId, r]));
  const max = Math.max(...rows.map((r) => r.entryCount), 1);
  rScale.domain([0, max]);
  renderNodes();
}

function renderNodes(): void {
  if (!manifest || !nodeGroup) return;
  const state = getState();
  const season = manifest.seasons.find((s) => s.id === state.selectedSeason);
  const activeIds = new Set(season?.dungeonIds ?? []);
  const eraFilter = new Set(state.filterEras.length ? state.filterEras : Object.keys(ERA_PALETTE));

  type Datum = DungeonMeta & { cx: number; cy: number; vol: VolumeRow | null };

  const data: Datum[] = manifest.dungeons.map((d) => ({
    ...d,
    cx: d.offWorld ? OFF_WORLD_X : d.mapX,
    cy: d.offWorld ? OFF_WORLD_Y : d.mapY,
    vol: volumeMap.get(d.id) ?? null,
  }));

  const nodes = nodeGroup
    .selectAll<SVGCircleElement, Datum>('circle.node')
    .data(data, (d) => String(d.id));

  nodes
    .enter()
    .append('circle')
    .attr('class', 'node')
    .attr('cx', (d) => d.cx)
    .attr('cy', (d) => d.cy)
    .style('cursor', 'pointer')
    .on('click', (_, d) => setState({ selectedDungeon: d.id }))
    .merge(nodes)
    .attr('r', (d) => (d.vol ? rScale(d.vol.entryCount) : MIN_R))
    .attr('fill', (d) => ERA_PALETTE[d.era])
    .attr('stroke', (d) => (d.id === state.selectedDungeon ? '#ffffff' : 'rgba(0,0,0,0.4)'))
    .attr('stroke-width', (d) => (d.id === state.selectedDungeon ? 2.5 : 1))
    .transition()
    .duration(300)
    .attr('opacity', (d) => (activeIds.has(d.id) && eraFilter.has(d.era) ? 1 : 0.15));

  nodes.exit().remove();
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --project tsconfig.json --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/charts/map.ts
git commit -m "🗺️ Add world map with dungeon nodes"
```

---

## Task 12: Season Scrubber

**Files:**
- Create: `src/charts/scrubber.ts`

- [ ] **Step 1: Create src/charts/scrubber.ts**

```typescript
// src/charts/scrubber.ts
import * as d3 from 'd3';
import type { SeasonMeta } from '../types';
import { setState, subscribe } from '../state';

export function initScrubber(container: HTMLElement, seasons: SeasonMeta[]): void {
  const el = d3.select(container);
  el.style('display', 'flex').style('align-items', 'center').style('gap', '6px');

  el.append('span')
    .text('Season:')
    .style('font-size', '12px')
    .style('color', '#9ca3af')
    .style('white-space', 'nowrap');

  const sorted = [...seasons].sort((a, b) => a.id - b.id);

  const buttons = el
    .selectAll<HTMLButtonElement, SeasonMeta>('button.s-btn')
    .data(sorted, (d) => String(d.id))
    .enter()
    .append('button')
    .attr('class', 's-btn')
    .text((d) => `S${d.id}`)
    .style('padding', '3px 10px')
    .style('border-radius', '4px')
    .style('border', 'none')
    .style('cursor', 'pointer')
    .style('font-size', '12px')
    .on('click', (_, d) => setState({ selectedSeason: d.id, selectedDungeon: null }));

  subscribe((state) => {
    buttons
      .style('background', (d) => (d.id === state.selectedSeason ? '#3b82f6' : '#374151'))
      .style('color', '#f9fafb');
  });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --project tsconfig.json --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/charts/scrubber.ts
git commit -m "⏱️ Add season scrubber"
```

---

## Task 13: Filter Bar

**Files:**
- Create: `src/charts/filters.ts`

- [ ] **Step 1: Create src/charts/filters.ts**

```typescript
// src/charts/filters.ts
import * as d3 from 'd3';
import type { Era } from '../types';
import { ERAS_IN_ORDER, ERA_LABELS, ERA_PALETTE } from '../config';
import { getState, setState, subscribe } from '../state';

export function initFilters(container: HTMLElement): void {
  const el = d3.select(container);
  el.style('display', 'flex').style('align-items', 'center').style('gap', '5px').style('flex-wrap', 'wrap');

  el.append('span').text('Era:').style('font-size', '11px').style('color', '#9ca3af');

  const eraButtons = el
    .selectAll<HTMLButtonElement, Era>('button.era-btn')
    .data(ERAS_IN_ORDER)
    .enter()
    .append('button')
    .attr('class', 'era-btn')
    .text((d) => ERA_LABELS[d])
    .style('padding', '2px 7px')
    .style('border-radius', '3px')
    .style('border', '1px solid transparent')
    .style('background', (d) => ERA_PALETTE[d])
    .style('color', '#fff')
    .style('font-size', '10px')
    .style('cursor', 'pointer')
    .on('click', (_, era) => {
      const current = getState().filterEras;
      const next = current.includes(era) ? current.filter((e) => e !== era) : [...current, era];
      setState({ filterEras: next });
    });

  // View mode toggle — right-aligned
  const toggle = el.append('div').style('margin-left', 'auto').style('display', 'flex').style('gap', '4px');

  const modes = [
    { value: 'era' as const, label: 'Era View' },
    { value: 'reintroduction' as const, label: 'Reintroduction View' },
  ];

  const modeButtons = toggle
    .selectAll<HTMLButtonElement, (typeof modes)[0]>('button.mode-btn')
    .data(modes)
    .enter()
    .append('button')
    .attr('class', 'mode-btn')
    .text((d) => d.label)
    .style('padding', '2px 10px')
    .style('border-radius', '3px')
    .style('border', 'none')
    .style('font-size', '11px')
    .style('cursor', 'pointer')
    .on('click', (_, d) => setState({ viewMode: d.value }));

  subscribe((state) => {
    const active = new Set(state.filterEras);
    eraButtons.style('opacity', (d) => (!active.size || active.has(d) ? '1' : '0.3'));
    modeButtons
      .style('background', (d) => (d.value === state.viewMode ? '#3b82f6' : '#374151'))
      .style('color', '#f9fafb');
  });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --project tsconfig.json --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/charts/filters.ts
git commit -m "🔍 Add filter bar with era toggles and view mode switch"
```

---

## Task 14: Detail Panel — Era View (Question A)

**Files:**
- Create: `src/charts/detail/era.ts`

- [ ] **Step 1: Create src/charts/detail/era.ts**

```typescript
// src/charts/detail/era.ts
import * as d3 from 'd3';
import type { DungeonMeta, VolumeRow, DungeonManifest } from '../../types';
import { ERA_PALETTE, ERA_LABELS } from '../../config';

export function renderEraView(
  container: HTMLElement,
  dungeon: DungeonMeta,
  thisDungeonVolume: VolumeRow | null,
  allVolume: VolumeRow[],
  manifest: DungeonManifest,
): void {
  const el = d3.select(container);
  el.selectAll('*').remove();

  el.append('p')
    .style('font-size', '11px')
    .style('color', '#9ca3af')
    .style('margin', '0 0 4px')
    .text('How does this dungeon compare to era peers this season?');

  const statText = thisDungeonVolume
    ? `${dungeon.name}: ${thisDungeonVolume.entryCount} top completions · max key ${thisDungeonVolume.maxKey}`
    : `${dungeon.name}: no data for this season`;

  el.append('p')
    .style('font-size', '12px')
    .style('color', '#d1d5db')
    .style('margin', '0 0 12px')
    .text(statText);

  const dungeonById = new Map(manifest.dungeons.map((d) => [d.id, d]));
  const countsByEra = new Map<string, number[]>();
  for (const row of allVolume) {
    const meta = dungeonById.get(row.dungeonId);
    if (!meta) continue;
    const list = countsByEra.get(meta.era) ?? [];
    list.push(row.entryCount);
    countsByEra.set(meta.era, list);
  }

  interface Bar { era: string; avg: number; n: number }
  const bars: Bar[] = Array.from(countsByEra.entries())
    .map(([era, counts]) => ({
      era,
      avg: counts.reduce((a, b) => a + b, 0) / counts.length,
      n: counts.length,
    }))
    .sort((a, b) => b.avg - a.avg);

  const w = container.clientWidth - 24;
  const rowH = 22;
  const labelW = 90;
  const xMax = Math.max(...bars.map((b) => b.avg), thisDungeonVolume?.entryCount ?? 1);
  const xScale = d3.scaleLinear().domain([0, xMax]).range([0, w - labelW - 55]);

  const svg = el.append('svg').attr('width', w).attr('height', bars.length * (rowH + 4));

  const row = svg
    .selectAll<SVGGElement, Bar>('g.bar-row')
    .data(bars)
    .enter()
    .append('g')
    .attr('transform', (_, i) => `translate(0,${i * (rowH + 4)})`);

  row.append('rect')
    .attr('x', labelW)
    .attr('width', (d) => xScale(d.avg))
    .attr('height', rowH)
    .attr('fill', (d) => ERA_PALETTE[d.era as keyof typeof ERA_PALETTE] ?? '#888')
    .attr('opacity', 0.7)
    .attr('rx', 2);

  // White overlay highlights this dungeon's contribution within its era bar
  row.filter((d) => d.era === dungeon.era)
    .append('rect')
    .attr('x', labelW)
    .attr('width', xScale(thisDungeonVolume?.entryCount ?? 0))
    .attr('height', rowH)
    .attr('fill', '#fff')
    .attr('opacity', 0.2)
    .attr('rx', 2);

  row.append('text')
    .attr('x', labelW - 4)
    .attr('y', rowH / 2)
    .attr('text-anchor', 'end')
    .attr('dominant-baseline', 'middle')
    .attr('fill', '#d1d5db')
    .style('font-size', '10px')
    .text((d) => ERA_LABELS[d.era as keyof typeof ERA_LABELS]?.split(' ').pop() ?? d.era);

  row.append('text')
    .attr('x', (d) => labelW + xScale(d.avg) + 4)
    .attr('y', rowH / 2)
    .attr('dominant-baseline', 'middle')
    .attr('fill', '#6b7280')
    .style('font-size', '10px')
    .text((d) => `avg ${Math.round(d.avg)} (${d.n}d)`);
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --project tsconfig.json --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/charts/detail/era.ts
git commit -m "📊 Add detail panel era view (Question A)"
```

---

## Task 15: Detail Panel — Reintroduction View (Question B)

**Files:**
- Create: `src/charts/detail/reintroduction.ts`

- [ ] **Step 1: Create src/charts/detail/reintroduction.ts**

```typescript
// src/charts/detail/reintroduction.ts
import * as d3 from 'd3';
import type { DungeonMeta, KeyDistRow } from '../../types';

export interface SeasonSnapshot {
  seasonId: number;
  isFirstAppearance: boolean;
  alwaysInPool: boolean;
  distribution: KeyDistRow[];
  maxKey: number;
  entryCount: number;
}

export function renderReintroductionView(
  container: HTMLElement,
  dungeon: DungeonMeta,
  snapshots: SeasonSnapshot[],
): void {
  const el = d3.select(container);
  el.selectAll('*').remove();

  el.append('p')
    .style('font-size', '11px')
    .style('color', '#9ca3af')
    .style('margin', '0 0 4px')
    .text('Does familiarity push key ceilings higher on reintroduction?');

  if (snapshots[0]?.alwaysInPool) {
    el.append('p')
      .style('font-size', '11px')
      .style('color', '#f59e0b')
      .style('margin', '0 0 8px')
      .text(`${dungeon.name} is always in pool — reintroduction comparison not applicable.`);
  }

  if (snapshots.length === 0) {
    el.append('p').style('color', '#6b7280').style('font-size', '12px').text('No season data.');
    return;
  }

  const allKeys = snapshots.flatMap((s) => s.distribution.map((r) => r.keystoneLevel));
  const allCounts = snapshots.flatMap((s) => s.distribution.map((r) => r.count));

  if (allKeys.length === 0) {
    el.append('p').style('color', '#6b7280').style('font-size', '12px').text('No key data available.');
    return;
  }

  const keyMin = Math.min(...allKeys);
  const keyMax = Math.max(...allKeys);
  const countMax = Math.max(...allCounts, 1);
  const chartH = 100;
  const colW = Math.max(40, Math.floor((container.clientWidth - 24) / snapshots.length) - 6);

  const xScale = d3.scaleLinear().domain([keyMin, keyMax]).range([2, colW - 2]);
  const yScale = d3.scaleLinear().domain([0, countMax]).range([chartH, 0]);
  const barW = Math.max(2, (colW - 4) / Math.max(keyMax - keyMin + 1, 1));

  const wrapper = el
    .append('div')
    .style('display', 'flex')
    .style('gap', '6px')
    .style('align-items', 'flex-end');

  for (const snap of snapshots) {
    const col = wrapper.append('div').style('flex', '0 0 auto');
    const color = snap.isFirstAppearance ? '#60a5fa' : '#a78bfa';
    const label = snap.isFirstAppearance ? `S${snap.seasonId} (1st)` : `S${snap.seasonId} ↩`;

    col.append('div')
      .style('font-size', '10px')
      .style('color', color)
      .style('text-align', 'center')
      .style('margin-bottom', '3px')
      .text(label);

    const svg = col
      .append('svg')
      .attr('width', colW)
      .attr('height', chartH)
      .style('background', '#1f2937')
      .style('border-radius', '3px');

    svg
      .selectAll<SVGRectElement, KeyDistRow>('rect')
      .data(snap.distribution)
      .enter()
      .append('rect')
      .attr('x', (d) => xScale(d.keystoneLevel))
      .attr('y', (d) => yScale(d.count))
      .attr('width', barW)
      .attr('height', (d) => chartH - yScale(d.count))
      .attr('fill', color);

    col.append('div')
      .style('font-size', '9px')
      .style('color', '#6b7280')
      .style('text-align', 'center')
      .style('margin-top', '2px')
      .text(`max ${snap.maxKey} · n=${snap.entryCount}`);
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --project tsconfig.json --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/charts/detail/reintroduction.ts
git commit -m "📈 Add detail panel reintroduction view (Question B)"
```

---

## Task 16: Detail Panel Shell + Full Integration

**Files:**
- Create: `src/charts/detail/index.ts`
- Modify: `src/charts/init.ts`

- [ ] **Step 1: Create src/charts/detail/index.ts**

```typescript
// src/charts/detail/index.ts
import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import type { DungeonManifest, VolumeRow } from '../../types';
import { subscribe, setState } from '../../state';
import { loadSeason } from '../../db/init';
import { getKeyDistribution, getCrossSeasonVolume } from '../../db/queries';
import { renderEraView } from './era';
import { renderReintroductionView } from './reintroduction';
import type { SeasonSnapshot } from './reintroduction';

let _container: HTMLElement;
let _manifest: DungeonManifest;
let _conn: AsyncDuckDBConnection;
let _allVolume: VolumeRow[] = [];

export function initDetail(
  container: HTMLElement,
  manifest: DungeonManifest,
  conn: AsyncDuckDBConnection,
): void {
  _container = container;
  _manifest = manifest;
  _conn = conn;

  subscribe((state) => {
    if (state.selectedDungeon !== null) {
      _container.classList.remove('hidden');
      render(state.selectedDungeon, state.selectedSeason, state.viewMode).catch(console.error);
    } else {
      _container.classList.add('hidden');
    }
  });
}

export function setAllVolume(rows: VolumeRow[]): void {
  _allVolume = rows;
}

function buildHeader(dungeon: DungeonManifest['dungeons'][0]): HTMLElement {
  const header = document.createElement('div');
  header.style.cssText =
    'padding:12px 16px;border-bottom:1px solid #374151;display:flex;align-items:center;gap:8px';

  const nameEl = document.createElement('strong');
  nameEl.textContent = dungeon.name;
  nameEl.style.cssText = 'font-size:14px;flex:1';

  const eraEl = document.createElement('span');
  eraEl.textContent = dungeon.era.toUpperCase();
  eraEl.style.cssText =
    'font-size:10px;color:#9ca3af;background:#374151;padding:2px 6px;border-radius:3px';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText =
    'background:none;border:none;color:#9ca3af;cursor:pointer;font-size:18px;line-height:1';
  closeBtn.addEventListener('click', () => setState({ selectedDungeon: null }));

  header.appendChild(nameEl);
  header.appendChild(eraEl);
  header.appendChild(closeBtn);
  return header;
}

async function render(
  dungeonId: number,
  seasonId: number,
  viewMode: 'era' | 'reintroduction',
): Promise<void> {
  const dungeon = _manifest.dungeons.find((d) => d.id === dungeonId);
  if (!dungeon) return;

  _container.replaceChildren();
  _container.appendChild(buildHeader(dungeon));

  const body = document.createElement('div');
  body.style.cssText = 'padding:12px 16px';
  _container.appendChild(body);

  if (viewMode === 'era') {
    const thisDungeonVolume = _allVolume.find((r) => r.dungeonId === dungeonId) ?? null;
    renderEraView(body, dungeon, thisDungeonVolume, _allVolume, _manifest);
  } else {
    const sortedSeasons = [...dungeon.seasons].sort((a, b) => a - b);
    const firstSeasonId = sortedSeasons[0];
    const alwaysInPool = sortedSeasons.length === _manifest.seasons.length;

    const snapshots: SeasonSnapshot[] = [];
    for (const sid of sortedSeasons) {
      await loadSeason(sid);
      const [dist, crossRows] = await Promise.all([
        getKeyDistribution(_conn, sid, dungeonId),
        getCrossSeasonVolume(_conn, dungeonId, [sid]),
      ]);
      const cv = crossRows[0];
      if (!cv) continue;
      snapshots.push({
        seasonId: sid,
        isFirstAppearance: sid === firstSeasonId,
        alwaysInPool,
        distribution: dist,
        maxKey: cv.maxKey,
        entryCount: cv.entryCount,
      });
    }

    renderReintroductionView(body, dungeon, snapshots);
  }
}
```

- [ ] **Step 2: Implement src/charts/init.ts**

```typescript
// src/charts/init.ts
import type { DungeonManifest } from '../types';
import { initDB, loadSeason, getConnection } from '../db/init';
import { getVolumeRows } from '../db/queries';
import { initMap, updateVolume } from './map';
import { initScrubber } from './scrubber';
import { initFilters } from './filters';
import { initDetail, setAllVolume } from './detail/index';
import { setState, subscribe } from '../state';

export default async function initViz(): Promise<void> {
  await initDB();

  const res = await fetch('/data/dungeons.json');
  if (!res.ok) throw new Error('Could not load /data/dungeons.json — run `npm run fetch` first');
  const manifest = (await res.json()) as DungeonManifest;

  const sorted = [...manifest.seasons].sort((a, b) => a.id - b.id);
  const firstSeason = sorted[0];
  if (!firstSeason) throw new Error('No seasons in manifest');

  await loadSeason(firstSeason.id);
  setState({ selectedSeason: firstSeason.id });

  const conn = getConnection();

  initMap(document.getElementById('map')!, manifest);
  initScrubber(document.getElementById('scrubber')!, manifest.seasons);
  initFilters(document.getElementById('filters')!);
  initDetail(document.getElementById('detail')!, manifest, conn);

  subscribe(async (state) => {
    if (!manifest.seasons.find((s) => s.id === state.selectedSeason)) return;
    await loadSeason(state.selectedSeason);
    const rows = await getVolumeRows(conn, state.selectedSeason);
    setAllVolume(rows);
    updateVolume(rows);
  });

  const initialRows = await getVolumeRows(conn, firstSeason.id);
  setAllVolume(initialRows);
  updateVolume(initialRows);
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --project tsconfig.json --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run all unit tests**

```bash
npm run test
```

Expected: auth and transform tests pass.

- [ ] **Step 5: Full browser smoke test**

```bash
npm run dev
```

Verify in browser:
- [ ] Dark layout renders with all four zones (filters, map, detail hidden, scrubber)
- [ ] Era buttons appear in the filter bar with correct colors
- [ ] Season buttons appear in the scrubber; clicking one highlights it
- [ ] Dungeon nodes appear on the map, sized by volume, colored by era
- [ ] Clicking a node opens the detail panel with dungeon name and era badge
- [ ] Era view shows a bar chart comparing eras; this dungeon's era is highlighted
- [ ] Switching to Reintroduction View shows small multiples per season
- [ ] Blue bars = first appearance, purple bars = reintroduction
- [ ] Always-in-pool dungeons show the amber warning text
- [ ] ✕ button closes the detail panel
- [ ] Era filter buttons dim non-matching nodes on the map
- [ ] Off-world label appears at the top-right corner of the map

- [ ] **Step 6: Production build**

```bash
npm run build
```

Expected: no errors, output in `dist/`.

- [ ] **Step 7: Commit**

```bash
git add src/charts/detail/index.ts src/charts/init.ts
git commit -m "🔌 Wire up all components and integrate data flow"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Covered in |
|---|---|
| Research question A (era → adoption) | Tasks 14, 16 |
| Research question B (reintroduction → key ceiling) | Tasks 15, 16 |
| B preferred if scope forces a choice | Noted in spec; team can change default `viewMode` in `src/state.ts` |
| Zoomable world map with dungeon nodes | Task 11 |
| Node encoding: size=volume, color=era | Task 11 |
| Season scrubber with node transitions | Tasks 12, 11 (opacity transition) |
| Global filter bar with era toggles | Task 13 |
| View mode toggle (Era / Reintroduction) | Task 13 |
| Detail panel — Era view (Question A) | Task 14 |
| Detail panel — Reintroduction view (Question B) | Task 15 |
| Off-world cluster label | Task 11 |
| Always-in-pool flag | Task 15 |
| DuckDB-Wasm in-browser OLAP | Tasks 8, 9 |
| Parquet pre-fetch pipeline | Tasks 4–7 |
| Manifest with manual era/coords | Task 7, step 5 |
| Current season excluded | Task 7 (end_timestamp check) |
| Inactive node fade (opacity 0.15) | Task 11 |
| High-end player scope called out | Tasks 14, 15 (description text) |
| Stretch goal (regional heatmap) | Intentionally excluded — stretch goal |

All core requirements covered.

**Placeholder scan:** Clean. The `era: 'vanilla'` placeholder in Task 7 is intentional and marked as a manual step.

**Type consistency:** `VolumeRow`, `KeyDistRow`, `CrossSeasonRow`, `DungeonManifest` defined once in `src/types.ts` (Task 2) and used consistently throughout. `SeasonSnapshot` defined and exported from `reintroduction.ts` (Task 15), imported in `detail/index.ts` (Task 16). `getCrossSeasonVolume` defined in Task 9, used in Task 16.
