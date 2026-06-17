import { initDB, getConnection } from '../db/init.js';
import { initDungeonBrowser } from './dungeon-browser.js';
import { initArc, setKeyDomain } from './arc.js';
import { initAffixChart } from './affix.js';
import { getGlobalKeyRange } from '../db/queries.js';
import { MAX_SEASON } from '../config.js';
import type { DungeonManifest } from '../types.js';

export default async function initViz(): Promise<void> {
  // Sequência de inicialização: DB primeiro, depois manifesto, depois charts.
  // initDungeonBrowser carrega todas as seasons para calcular medianas do ranking,
  // o que permite que getGlobalKeyRange já encontre as tabelas em memória.
  await initDB();

  const response = await fetch(`${import.meta.env.BASE_URL}data/dungeons.json`);
  const manifest: DungeonManifest = await response.json();

  const conn = getConnection();

  await initDungeonBrowser(document.getElementById('dungeon-rankings')!, manifest, conn);
  await initArc(document.getElementById('key-progression')!, manifest, conn);

  // Calcula o domínio global do eixo Y após o Dungeon Browser já ter carregado
  // as seasons — o padding de ±3 evita que linhas toquem as bordas do SVG.
  // Esse domínio é compartilhado via setKeyDomain() para todas as views do Arc Chart (§4.4).
  const seasonIds = manifest.seasons
    .filter(s => s.dungeonIds.length > 0 && s.id <= MAX_SEASON)
    .map(s => s.id);
  const { minKey, maxKey } = await getGlobalKeyRange(conn, seasonIds);
  setKeyDomain(Math.floor(minKey) - 3, Math.ceil(maxKey) + 3);

  await initAffixChart(conn, manifest);
}
