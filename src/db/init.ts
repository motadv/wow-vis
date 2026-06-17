import * as duckdb from '@duckdb/duckdb-wasm';
import ehWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import ehWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import type { AffixManifest } from '../types.js';

// Singletons de DB e conexão — um único motor DuckDB-Wasm por sessão do navegador.
let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;
// Rastreia quais seasons já foram carregadas para evitar re-fetch (§4.2 do relatório).
const loadedSeasons = new Set<number>();
let affixManifest: AffixManifest | null = null;

async function loadAffixes(): Promise<void> {
  const url = new URL(`${import.meta.env.BASE_URL}data/affixes.json`, window.location.origin).href;
  const response = await fetch(url);
  affixManifest = await response.json();
}

export async function initDB(): Promise<void> {
  // Forçamos o bundle EH (exception-handling, single-threaded) mesmo quando
  // crossOriginIsolated é true.  O bundle COI tem incompatibilidade de memória
  // compartilhada com a extensão wasm_threads parquet do DuckDB v1.5.1:
  // a extensão declara `memory shared=0` mas o módulo COI a importa como shared=1,
  // causando LinkError em tempo de carga.  O bundle EH e sua extensão wasm_eh
  // usam memória não-compartilhada, evitando o erro.
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
  const worker = new Worker(ehWorker);
  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(ehWasm, null);
  conn = await db.connect();

  // Manifesto de afixos carregado uma vez na inicialização — usado por queries e tooltips.
  await loadAffixes();
}

// Carregamento lazy de seasons: só registra e cria a tabela DuckDB quando a season
// é realmente necessária (usuário seleciona uma dungeon daquela season).
// Uma vez carregada, a tabela permanece em memória e não é recarregada (§4.2).
export async function loadSeason(seasonId: number): Promise<void> {
  if (!conn || !db) throw new Error('DB not initialized');
  if (loadedSeasons.has(seasonId)) return;

  const name = `season-${seasonId}.parquet`;
  const url = new URL(`${import.meta.env.BASE_URL}data/${name}`, window.location.origin).href;
  // Registra o arquivo remoto para que DuckDB possa acessá-lo via HTTP.
  await db.registerFileURL(name, url, duckdb.DuckDBDataProtocol.HTTP, false);

  const table = `leaderboard_${seasonId}`;
  // Cria a tabela in-memory a partir do Parquet — todas as queries subsequentes
  // operam sobre esta tabela sem re-fetch de rede.
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
