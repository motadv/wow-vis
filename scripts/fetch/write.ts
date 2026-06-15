import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import duckdb from 'duckdb';
import type { AffixManifest, DungeonManifest, LeaderboardEntry } from './types.js';

const OUT_DIR = 'public/data';

export async function ensureOutDir(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
}

export async function writeParquet(seasonId: number, entries: LeaderboardEntry[]): Promise<void> {
  const ndjson = entries.map(e => JSON.stringify(e)).join('\n');
  const tmpPath = join(tmpdir(), `season-${seasonId}-${Date.now()}.ndjson`);
  await writeFile(tmpPath, ndjson, 'utf8');

  const outPath = join(OUT_DIR, `season-${seasonId}.parquet`);

  await new Promise<void>((resolve, reject) => {
    const db = new duckdb.Database(':memory:');
    db.run(
      `COPY (SELECT * FROM read_ndjson_auto('${tmpPath}')) TO '${outPath}' (FORMAT PARQUET)`,
      (err: Error | null) => {
        if (err) {
          db.close(() => reject(err));
        } else {
          db.close(() => resolve());
        }
      },
    );
  });

  await unlink(tmpPath);
}

export async function writeManifest(manifest: DungeonManifest): Promise<void> {
  const outPath = join(OUT_DIR, 'dungeons.json');
  await writeFile(outPath, JSON.stringify(manifest, null, 2), 'utf8');
}

export async function writeAffixManifest(manifest: AffixManifest): Promise<void> {
  const outPath = join(OUT_DIR, 'affixes.json');
  await writeFile(outPath, JSON.stringify(manifest, null, 2), 'utf8');
}
