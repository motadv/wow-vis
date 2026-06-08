import * as duckdb from '@duckdb/duckdb-wasm';
import mvpWasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvpWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import ehWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import ehWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import coiWasm from '@duckdb/duckdb-wasm/dist/duckdb-coi.wasm?url';
import coiWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-coi.worker.js?url';
import coiPthread from '@duckdb/duckdb-wasm/dist/duckdb-browser-coi.pthread.worker.js?url';

const BUNDLES: duckdb.DuckDBBundles = {
  mvp: { mainModule: mvpWasm, mainWorker: mvpWorker },
  eh: { mainModule: ehWasm, mainWorker: ehWorker },
  coi: { mainModule: coiWasm, mainWorker: coiWorker, pthreadWorker: coiPthread },
};

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;
const loadedSeasons = new Set<number>();

export async function initDB(): Promise<void> {
  const bundle = await duckdb.selectBundle(BUNDLES);
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
  const worker = new Worker(bundle.mainWorker!);
  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  conn = await db.connect();
}

export async function loadSeason(seasonId: number): Promise<void> {
  if (!conn) throw new Error('DB not initialized');
  if (loadedSeasons.has(seasonId)) return;

  const table = `leaderboard_${seasonId}`;
  await conn.query(
    `CREATE TABLE IF NOT EXISTS ${table} AS
     SELECT * FROM read_parquet('/data/season-${seasonId}.parquet')`,
  );
  loadedSeasons.add(seasonId);
}

export function getConnection(): duckdb.AsyncDuckDBConnection {
  if (!conn) throw new Error('DB not initialized');
  return conn;
}
