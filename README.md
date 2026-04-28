# ⚔️ WoW Data Analytics - UFF 2026.1

Projeto desenvolvido para as disciplinas de **Visualização de Dados** e **Game Analytics** do programa de Mestrado em Computação da **Universidade Federal Fluminense (UFF)**.

Este projeto visa explorar e visualizar dados complexos da API de _World of Warcraft_ (Blizzard), utilizando tecnologias modernas de processamento in-browser para gerar insights sobre a economia e o comportamento dos jogadores.

---

## 👥 Integrantes

- **Bruna Becker** ([GitHub/LinkedIn Link])
- **Pedro Lanzarini** ([GitHub/LinkedIn Link])
- **Rodrigo Mota** ([GitHub/LinkedIn Link])

---

## 🎯 A Pergunta de Pesquisa

> **"[INSERIR AQUI A PERGUNTA DE PESQUISA]"**

---

## 🛠️ Stack Tecnológica

O projeto utiliza uma stack de ponta focada em performance e tipagem estática:

- **[Vite](https://vitejs.dev/):** Build tool ultra-rápida para o frontend.
- **[TypeScript](https://www.typescriptlang.org/):** Garantia de tipos para manipulação segura dos dados da API.
- **[D3.js](https://d3js.org/):** Biblioteca principal para a criação de visualizações personalizadas e interativas.
- **[DuckDB-Wasm](https://duckdb.org/docs/api/wasm/overview):** Banco de dados SQL analítico executando diretamente no navegador para processamento de grandes volumes de dados (OLAP).
- **[Tailwind CSS](https://tailwindcss.com/):** Framework utilitário para construção da interface e layout do dashboard.

---

## 📂 Estrutura do Projeto

```text
├── public/             # Arquivos estáticos e snapshots de dados da API (JSON/Parquet)
├── src/
│   ├── api/            # Manipulação de dados da API da Blizzard
│   ├── charts/         # Gráficos interativos via D3.js
│   ├── db/             # Banco de dados DuckDB-Wasm
│   └── utils/          # Conjunto de funções utilitárias
│   ├── config.ts       # Configurações globais
│   ├── main.ts         # Ponto de entrada do projeto
│   ├── style.css       # Arquivo de estilização geral do projeto + Tailwind
├── index.html          # Página principal do dashboard
├── package.json        # Arquivo de dependências e scripts
└── tsconfig.json       # Configurações de compilação do TypeScript
```

---

## 🚀 Como Rodar o Projeto

### Pré-requisitos

- Node.js (v18 ou superior)
- Uma conta no [Blizzard Battle.net Developer Portal](https://develop.battle.net/) para obter suas credenciais de API.

### Instalação

1. Clone o repositório:
   ```bash
   git clone [URL AQUI]
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure as variáveis de ambiente:
   Crie um arquivo `.env` na raiz do projeto com suas chaves:
   ```env
   VITE_BLIZZARD_CLIENT_ID=seu_id_aqui
   VITE_BLIZZARD_CLIENT_SECRET=sua_secret_aqui
   ```

### Desenvolvimento

Para rodar o servidor local com Hot Reload:

```bash
npm run dev
```

---

## 📄 Licença

Este projeto está licenciado sob a **Licença MIT** - consulte o arquivo [LICENSE](LICENSE) para detalhes. É uma licença permissiva que permite o uso acadêmico e comercial, modificação e distribuição, desde que mantidos os créditos originais.

---

**Nota:** Este projeto possui fins estritamente educativos como parte dos requisitos das disciplinas de pós-graduação da UFF.
