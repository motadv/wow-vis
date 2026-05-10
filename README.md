# ⚔️ WoW Data Analytics - UFF 2026.1

Projeto desenvolvido para as disciplinas de **Visualização de Dados** e **Game Analytics** do programa de Mestrado em Computação da **Universidade Federal Fluminense (UFF)**.

---

## 👥 Integrantes

- **Bruna Becker**
- **Pedro Lanzarini**
- **Rodrigo Mota**

---

## 🎯 Pergunta de Pesquisa

> **"Como a era de origem de uma masmorra e seu histórico de reintrodução influenciam a adoção por jogadores de alto nível e a progressão de keystones ao longo das temporadas de Mythic+?"**

Duas sub-questões norteiam a análise:

- **Questão A (Era):** A era de origem de uma masmorra prediz sua adoção quando ela entra na rotação de Mythic+?
- **Questão B (Reintrodução):** Quando uma masmorra é reintroduzida após ausência de uma ou mais temporadas, a familiaridade dos jogadores resulta em keystones mais altos em comparação à sua primeira aparição?

> **Prioridade:** Se o escopo forçar a escolha de uma única questão, a **Questão B é preferida** — é mais original e conta uma história mais clara sobre o ciclo de design da Blizzard.

---

## ⚠️ Limitação dos Dados

A API pública da Blizzard expõe apenas o **topo do leaderboard por reino conectado** — não o total de runs da população geral. Todos os achados refletem comportamento de **jogadores de alto nível** (key pushers), não da base de jogadores como um todo. Isso deve ser declarado explicitamente no trabalho.

---

## 🛠️ Stack Tecnológica

- **[Vite](https://vitejs.dev/)** + **[TypeScript](https://www.typescriptlang.org/):** Build e tipagem estática.
- **[D3.js](https://d3js.org/):** Visualizações interativas em SVG.
- **[DuckDB-Wasm](https://duckdb.org/docs/api/wasm/overview):** OLAP in-browser via WebAssembly para queries sobre os dados de Parquet.
- **Plain CSS:** Estilização sem framework.
- **Node.js + [tsx](https://github.com/privatenumber/tsx) + [duckdb](https://www.npmjs.com/package/duckdb):** Script offline para coleta e conversão dos dados da API.
- **[Vitest](https://vitest.dev/):** Testes unitários para o pipeline de dados.

---

## 📂 Estrutura do Projeto

```text
├── public/
│   ├── map.png                  # Mapa do mundo de Azeroth (asset manual)
│   └── data/
│       ├── dungeons.json        # Manifesto de masmorras (gerado + editado manualmente)
│       └── season-N.parquet     # Dados de leaderboard por temporada (gerado pelo script)
├── scripts/
│   └── fetch/                   # Script offline de coleta da API Blizzard
│       ├── auth.ts              # OAuth client credentials
│       ├── blizzard.ts          # Wrappers para endpoints da API
│       ├── transform.ts         # Transformação dos dados brutos
│       ├── write.ts             # Escrita em Parquet e JSON
│       └── index.ts             # Orquestrador CLI
├── src/
│   ├── types.ts                 # Tipos compartilhados da camada de visualização
│   ├── state.ts                 # Estado reativo global (selectedSeason, selectedDungeon)
│   ├── config.ts                # Paleta de eras, dimensões do mapa, constantes
│   ├── db/
│   │   ├── init.ts              # Inicialização do DuckDB-Wasm e carregamento de Parquet
│   │   └── queries.ts           # Funções de query tipadas
│   ├── charts/
│   │   ├── map.ts               # Mapa SVG com nós de masmorras
│   │   ├── scrubber.ts          # Timeline de temporadas
│   │   ├── filters.ts           # Filtros de era e toggle de modo de visualização
│   │   ├── init.ts              # Orquestrador das visualizações
│   │   └── detail/
│   │       ├── index.ts         # Shell do painel de detalhes
│   │       ├── era.ts           # Visão de Era (Questão A)
│   │       └── reintroduction.ts# Visão de Reintrodução (Questão B)
│   ├── main.ts                  # Ponto de entrada
│   └── style.css                # Reset base
├── index.html                   # Dashboard principal
├── vite.config.ts               # Config do Vite (headers COOP/COEP para DuckDB-Wasm)
├── tsconfig.json                # Config TypeScript para o browser
└── scripts/tsconfig.json        # Config TypeScript para os scripts Node.js
```

---

## 🚀 Como Rodar o Projeto

### Pré-requisitos

- Node.js v18+
- Conta no [Blizzard Battle.net Developer Portal](https://develop.battle.net/) para obter credenciais de API

### Instalação

```bash
npm install
```

Configure o `.env` na raiz:

```env
VITE_BLIZZARD_CLIENT_ID=seu_id_aqui
VITE_BLIZZARD_CLIENT_SECRET=sua_secret_aqui
```

### Coleta de dados (executar uma vez)

```bash
npm run fetch
```

Este script autentica na API da Blizzard, busca os dados de leaderboard de Mythic+ para todas as temporadas completas (amostrando reinos de alta população nos EUA) e grava os resultados em `public/data/`.

Após a execução, edite manualmente `public/data/dungeons.json` e preencha para cada masmorra:
- `era` — era de origem (`"vanilla"`, `"tbc"`, `"wotlk"`, `"cata"`, `"mop"`, `"wod"`, `"legion"`, `"bfa"`, `"shadowlands"`, `"dragonflight"`, `"tww"`)
- `mapX` / `mapY` — coordenadas em pixels no arquivo `public/map.png`
- `offWorld` — `true` para masmorras sem localização no mapa principal de Azeroth (ex: Argus, Draenor alternativo)

Adicione também o arquivo `public/map.png` (mapa de Azeroth em alta resolução, disponível na WoW Wiki).

### Desenvolvimento

```bash
npm run dev
```

### Testes

```bash
npm test
```

### Build de produção

```bash
npm run build
```

---

## 🗺️ Layout do Dashboard

O dashboard é composto por quatro zonas:

| Zona | Elemento | Função |
|---|---|---|
| Topo | Barra de filtros | Toggles de era, alternância de modo de visualização |
| Centro-esquerda | Mapa do mundo | Nós de masmorras (tamanho = volume, cor = era), zoom/pan |
| Centro-direita | Painel de detalhes | Visão de Era (Questão A) ou Reintrodução (Questão B) por masmorra |
| Rodapé | Scrubber de temporadas | Navegar entre temporadas anima os nós no mapa |

---

## 📄 Licença

MIT — uso acadêmico e educativo.
