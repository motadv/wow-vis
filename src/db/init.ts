import * as duckdb from '@duckdb/duckdb-wasm';
import ehWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import ehWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import type { AffixManifest } from '../types.js';

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;
const loadedSeasons = new Set<number>();
let affixManifest: AffixManifest | null = null;

async function loadAffixes(): Promise<void> {
  const url = new URL('/data/affixes.json', window.location.origin).href;
  const response = await fetch(url);
  affixManifest = await response.json();
}

export async function initDB(): Promise<void> {
  // Force the EH (exception-handling, single-threaded) bundle even when
  // crossOriginIsolated is true.  The COI bundle has a shared-memory
  // declaration mismatch with the wasm_threads parquet extension in DuckDB
  // v1.5.1: the extension declares `memory shared=0` but the COI module
  // imports it as shared=1, causing a LinkError at load time.
  // The EH bundle and its wasm_eh parquet extension both use non-shared
  // memory so the extension loads cleanly.
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
  const worker = new Worker(ehWorker);
  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(ehWasm, null);
  conn = await db.connect();

  await loadAffixes();
}

export async function loadSeason(seasonId: number): Promise<void> {
  if (!conn || !db) throw new Error('DB not initialized');
  if (loadedSeasons.has(seasonId)) return;

  const name = `season-${seasonId}.parquet`;
  const url = new URL(`/data/${name}`, window.location.origin).href;
  await db.registerFileURL(name, url, duckdb.DuckDBDataProtocol.HTTP, false);

  const table = `leaderboard_${seasonId}`;
  await conn.query(
    `CREATE TABLE IF NOT EXISTS ${table} AS SELECT * FROM read_parquet('${name}')`,
  );
  loadedSeasons.add(seasonId);
}

export function getConnection(): duckdb.AsyncDuckDBConnection {
  if (!conn) throw new Error('DB not initialized');
  return conn;
}

export function getAffixManifest(): AffixManifest {
  if (!affixManifest) throw new Error('Affix manifest not loaded');
  return affixManifest;
}
