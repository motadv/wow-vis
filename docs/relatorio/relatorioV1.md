# Análise de Balanceamento de Dungeons Mythic+ de World of Warcraft por Visualização de Dados

**Disciplina:** Visualização de Dados - Trabalho 02  
**Aluno:** Rodrigo Sodré  
**Professor:** Marcos Lage

---

# Escolhas de Design e Interações com base no Framework de Três Níveis de Tamara Munzner

---

## 1. What (Dados)

### 1.1 Fonte e Natureza do Dataset

O dataset utilizado provém da API pública da Blizzard Entertainment, disponível gratuitamente mediante cadastro no portal de desenvolvedores da empresa. Os dados correspondem às tabelas de classificação (_leaderboards_) do modo Mythic+ do jogo _World of Warcraft_, que registram os grupos de jogadores que completaram dungeons em um determinado nível de keystone em cada semana de jogo.

Os dados coletados e processados estão armazenados em arquivos no formato Apache Parquet em `public/data/`, organizados por temporada (`season-N.parquet`). Dois arquivos de configuração complementam o dataset: `dungeons.json`, que define o catálogo de dungeons e suas temporadas com metadados como abreviação e era de conteúdo; e `affixes.json`, que define os afixos disponíveis por temporada e as combinações ativas em cada semana.

O tipo do dataset é **tabular**, com os seguintes atributos por registro:

| Atributo         | Tipo               | Descrição                                               |
| ---------------- | ------------------ | ------------------------------------------------------- |
| `dungeon_id`     | Categórico (chave) | Identificador da dungeon                                |
| `season_id`      | Ordinal            | Identificador da temporada                              |
| `period`         | Ordinal            | Identificador da semana da temporada                    |
| `realm_id`       | Categórico         | Servidor de origem do grupo                             |
| `keystone_level` | Quantitativo       | Nível da keystone completada pelo grupo                 |
| `duration_ms`    | Quantitativo       | Duração da run em milissegundos                         |
| `fortified`      | Booleano           | Indica se o afixo Fortified estava ativo naquela semana |

### 1.2 Transformações e Decisões de Processamento

**Pipeline offline:** O script `scripts/fetch/` autentica-se via OAuth com a API da Blizzard e coleta as leaderboards para uma amostra de _connected realms_ de alta população dos servidores norte-americanos (IDs 3676, 60, 57, 3684, 11, correspondentes aos servidores Area 52, Stormrage, Illidan, Mal'Ganis e Tichondrius). A amostragem por servidores populacionalmente representativos visa reduzir vieses de distribuição e capturar o desempenho da comunidade ativa de forma estatisticamente mais robusta do que uma coleta exaustiva de todos os servidores.

**Transformação principal:** A função `transformLeaderboard()` converte as respostas brutos da API, extraindo o campo `map_challenge_mode_id` como identificador canônico da dungeon (distinto do `id` genérico do endpoint de temporadas) e derivando o atributo booleano `fortified` a partir da lista de afixos ativos na semana. Os afixos primários de uma dungeon são Fortified e Tyrannical. O afixo Fortified é mutualmente exclusivo com Tyrannical.

**Agregação:** A métrica central do sistema é a **mediana do nível de keystone** (`MEDIAN(keystone_level)`) calculada via DuckDB-Wasm no navegador, agrupada por dungeon e semana (`period`). A mediana foi preferida à média por ser robusta a outliers: grupos que completam níveis muito elevados (ou muito baixos) não distorcem a estimativa central do desempenho da comunidade.

Para o cálculo do impacto dos afixos secundários, define-se primeiro uma **baseline**: a mediana global do nível de keystone sobre todas as semanas da temporada (`MEDIAN(keystone_level)` sem filtro de período). Em seguida, para cada afixo secundário, o manifesto `affixes.json` fornece a lista de semanas (`period`) em que aquele afixo esteve ativo. Calcula-se então a mediana do keystone level restringida exclusivamente a essas semanas. O **delta de impacto** é a diferença entre as duas medianas: `mediana_semanas_com_afixo − mediana_global`. Um delta positivo indica que, nas semanas em que o afixo esteve presente, a comunidade alcançou níveis de keystone acima da média da temporada, o afixo está associado a semanas mais fáceis; um delta negativo indica o oposto. Importante notar que essa é uma medida de correlação, não de causalidade: o delta pode refletir interações com outros afixos ativos simultaneamente naquelas semanas.

**Escopo temporal e exclusões deliberadas:**

- **Dados pré-_Battle for Azeroth_ não incluídos:** a API da Blizzard não retorna dados de leaderboard para temporadas anteriores à expansão _Battle for Azeroth_; os registros simplesmente não estão disponíveis no endpoint consultado.
- **Dados pós-_Dragonflight_ Season 4 não incluídos:** a partir da expansão _The War Within_, o sistema de Mythic+ sofreu alterações estruturais significativas: os afixos Fortified e Tyrannical passaram a estar ativos simultaneamente em todas as semanas, e o sistema de rotação de dungeons foi reformulado. Incorporar essas temporadas exigiria lógica de renderização substancialmente diferente e dificultaria a comparação direta com temporadas anteriores. A exclusão foi uma decisão de escopo para manter a coerência do modelo de dados e a clareza da narrativa analítica.
- **Season 1 de Shadowlands e Season 1 de Dragonflight desabilitadas:** a coleta de dados para essas duas temporadas retornou apenas um único período (semana), o que inviabiliza a representação de uma série temporal evolutiva no Arc Chart. Renderizá-las geraria pontos isolados sem contexto comparativo, introduzindo outliers visuais sem valor analítico. Ambas são excluídas via constante `DISABLED_SEASONS`.

---

## 2. Why (Tarefas)

O sistema foi concebido para suportar a análise do **balanceamento de dungeons** ao longo das temporadas de Mythic+, endereçando tanto uma audiência especializada (jogadores e criadores de conteúdo que buscam padrões de dificuldade) quanto uma perspectiva de _game analytics_ (análise comparativa de balanceamento entre expansões).

As tarefas são descritas utilizando a nomenclatura de **Ação** e **Alvo** proposta por Munzner:

### T1 - Identificar a distribuição de dificuldade entre dungeons em uma temporada

- **Ação:** _Identify_
- **Alvo:** Distribuição de um atributo quantitativo (mediana de keystone) sobre um conjunto de itens (dungeons) em uma temporada específica.
- **Motivação:** O Dungeon Browser apresenta todas as dungeons de uma temporada ranqueadas por mediana de keystone, permitindo ao usuário identificar rapidamente quais dungeons foram mais ou menos acessíveis à comunidade. A visão coordenada com o Arc Chart permite detalhar a evolução semanal ao selecionar uma dungeon de interesse.

### T2 - Comparar o desempenho de uma dungeon entre as temporadas em que ela apareceu

- **Ação:** _Compare_
- **Alvo:** Tendência de um atributo quantitativo (mediana de keystone por semana) entre múltiplos itens categóricos (temporadas).
- **Motivação:** Dungeons reaparecem em temporadas diferentes com ajustes de balanceamento. O Arc Chart exibe uma linha por temporada para a dungeon selecionada, usando a mesma escala de eixos em todas as views para que a comparação visual não seja distorcida.

### T3 - Comparar o desempenho entre múltiplas dungeons em uma mesma temporada

- **Ação:** _Compare_
- **Alvo:** Tendência de múltiplos atributos quantitativos (medianas de keystone de dungeons distintas) ao longo do tempo, dentro de uma temporada.
- **Motivação:** A view de _multi dungeon comparison por temporada_ do Arc Chart exibe uma linha por dungeon selecionada, filtrada pela temporada escolhida via botão, permitindo identificar quais dungeons apresentaram comportamento mais volátil ou discrepante ao longo das semanas.

### T4 - Identificar em quais temporadas uma dungeon esteve presente

- **Ação:** _Locate_
- **Alvo:** Existência de itens (instâncias da dungeon) dentro de um conjunto (conjunto de temporadas visíveis no Dungeon Browser).
- **Motivação:** O hover sobre uma tile no Dungeon Browser destaca todas as aparições daquela dungeon em outras temporadas, mantendo as demais esmaecidas. Isso é especialmente útil para mapear o ciclo de vida de uma dungeon ao longo das expansões.

### T5 - Identificar como os afixos secundários afetam a dificuldade de uma dungeon

- **Ação:** _Identify_
- **Alvo:** Valores de um atributo quantitativo derivado (delta de mediana de keystone por afixo) para um conjunto de itens (afixos) em múltiplas temporadas.
- **Motivação:** O Affix Chart mapeia o impacto de cada afixo secundário como um heatmap de deltas, revelando se um determinado afixo tende a facilitar ou dificultar a dungeon em relação à sua baseline semanal.

### T6 - Comparar o impacto dos afixos primários (Fortified vs. Tyrannical) entre temporadas e dungeons

- **Ação:** _Compare_
- **Alvo:** Valores de dois atributos derivados (delta Fortified e delta Tyrannical) entre múltiplos itens (temporadas e dungeons).
- **Motivação:** As primeiras linhas do Affix Chart são reservadas para os afixos primários, permitindo comparar em quais temporadas uma dungeon foi mais difícil sob Tyrannical do que sob Fortified, e vice-versa.

### Necessidade de visões coordenadas

Nenhuma das tarefas acima é endereçável por uma única visualização estática. A coordenação entre as três views resolve a tensão entre _overview_ e _detail on demand_: o Dungeon Browser provê o panorama geral de todo o dataset (distribuição de dificuldade entre dungeons e temporadas); o Arc Chart fornece os detalhes temporais de séries individuais ou comparadas; e o Affix Chart acrescenta a dimensão causal (por que a dificuldade variou semana a semana). A seleção de uma dungeon no Dungeon Browser propaga-se simultaneamente para o Arc Chart e o Affix Chart, eliminando a necessidade de o usuário recontextualizar manualmente as três visões.

---

## 3. How (Design)

### 3.1 Dungeon Browser (Swimlane Chart)

**Marcadores e canais visuais:**

O Dungeon Browser representa cada par (dungeon, temporada) como um **retângulo** (marca: área) posicionado em uma grade de _swimlanes_. Dentro de cada temporada, as dungeons são ordenadas da esquerda (menor mediana de keystone, mais difícil para a comunidade completar em níveis altos) para a direita (maior mediana). Os canais utilizados são:

- **Posição horizontal** (eficácia máxima para dados ordinais/quantitativos, segundo Munzner): codifica o _ranking_ de dificuldade relativa entre dungeons dentro de cada temporada.
- **Matiz (hue)**: codifica a _era de conteúdo_ da dungeon (expansão de origem), permitindo que usuários familiarizados com o domínio do jogo reconheçam rapidamente a procedência do conteúdo. A legenda por expansão está visível na interface.
- **Luminosidade/saturação**: reduzida nas tiles não relacionadas ao hover, guiando a atenção ao item inspecionado.
- **Texto abreviado** (rótulo): cada tile exibe a abreviação da dungeon, preservando a identidade sem ocupar espaço excessivo.

**Separação por Era:** As temporadas são agrupadas em blocos por expansão do WoW (_Battle for Azeroth_, _Shadowlands_, _Dragonflight_), criando separação visual e conceitual que reduz a carga cognitiva ao navegar por um grande número de temporadas.

**Interações:**

- **Hover sobre uma tile:** aciona uma _tooltip_ com o nome completo da dungeon, a temporada e a mediana de keystone. Simultaneamente, realiza _highlight_ de todas as tiles da mesma dungeon em outras temporadas (mantendo-as iluminadas) e esmaece as demais, implementando a tarefa T4 sem necessidade de navegação adicional. Segundo a Taxonomia de Interações de Munzner, esta é uma interação de **seleção + codificação visual dinâmica** que suporta _overview_ e _connection_ entre instâncias relacionadas.
- **Clique em uma tile:** seleciona a dungeon, propagando `selectedDungeons` via pub/sub para as demais views. A interação é do tipo **navegação com foco** (_select → focus_).
- **Barra de pesquisa:** filtra as tiles pelo nome completo da dungeon, realizando _highlight_ dos resultados e esmaecendo os demais, interação do tipo **filtragem por atributo textual**.

### 3.2 Arc Chart (Gráfico de Linhas Temporais)

O Arc Chart é uma visualização multi-modo que adapta sua representação conforme a quantidade de dungeons selecionadas. A escala dos eixos X (semanas ordenadas dentro da temporada) e Y (nível de keystone mediano) é global e compartilhada entre todos os modos, preservando a comparabilidade visual sem distorção de escala.

**Canais visuais:**

- **Posição Y** (canal de maior eficácia para dados quantitativos): mediana de keystone em cada semana.
- **Posição X**: índice ordinal da semana dentro da temporada (semana 1 = primeira semana da temporada, não a semana absoluta do dataset), permitindo comparar temporadas de durações diferentes no mesmo espaço visual.
- **Matiz** por temporada (modo _single dungeon_) ou por dungeon (modo _multi dungeon_).
- **Marcadores circulares** (_dots_) em cada ponto de dado: facilitam a identificação dos valores discretos sobre a curva interpolada, evitando ambiguidade entre semanas próximas.
- **Linha vertical pontilhada** ao final de cada temporada: delimita o término da temporada sem poluir visualmente a área de dados; a opacidade reduzida hierarquiza esse elemento como informação secundária.

**Modo _single dungeon_:**

Exibe uma linha por temporada em que a dungeon esteve presente. O hover sobre o gráfico (sem temporada selecionada) exibe uma _tooltip_ com a mediana de keystone e os afixos ativos para cada temporada naquela semana. Ao clicar em uma linha, a temporada é selecionada e uma **linha horizontal pontilhada** é desenhada no nível da mediana das medianas semanais daquela temporada, funcionando como referência de desempenho esperado. A _tooltip_ passa a exibir também o delta em relação a essa referência, suportando a tarefa T2 com comparação explícita. A linha de referência é calculada como a mediana das medianas semanais, mantendo a estatística coerente com o restante do sistema.

**Modo _multi dungeon_ (agregado):**

Quando múltiplas dungeons são selecionadas, cada dungeon é representada por sua série histórica agregada (sobre todas as suas temporadas). Linhas adicionais com menor opacidade exibem as seasons individuais para contextualizar a agregação. Botões de seleção de temporada são exibidos quando as dungeons selecionadas têm seasons em comum, permitindo ao usuário restringir a comparação a uma temporada específica.

**Modo _multi dungeon comparison por temporada_:**

Ativado ao selecionar uma temporada via botão no modo multi. Exibe exclusivamente os dados de cada dungeon selecionada naquela temporada, facilitando a comparação semana a semana (tarefa T3). A _tooltip_ informa a mediana de cada dungeon e os afixos ativos naquela semana.

**Interações (Taxonomia de Munzner):**

- **Hover (exploração):** _Navigation > Explore_ - permite inspecionar dados sem comprometer o estado de seleção.
- **Click em linha (seleção de temporada):** _Selection > Select_ - filtra e destaca.
- **Botões de temporada:** _Navigation > Filter_ - restringem o conjunto de dados visível mantendo as escalas globais.

### 3.3 Affix Chart (Heatmap de Impacto de Afixos)

**Estrutura e canais visuais:**

O Affix Chart é um **heatmap** onde:

- As **colunas** representam as temporadas em que a dungeon apareceu, com uma coluna adicional à direita, rotulada "AVG", exibindo a média aritmética dos deltas ao longo de todas as temporadas em que o afixo esteve presente. Para os afixos primários, essa média é calculada sobre os deltas por temporada em `buildAffixMatrixData()`; para os afixos secundários, em `getSecondaryAffixImpactAllSeasons()`, como `avgDelta = Σ(delta_por_season) / n_seasons`.
- As **linhas** representam os afixos: as duas primeiras linhas são reservadas para os afixos primários (Fortified e Tyrannical) e as linhas seguintes para os afixos secundários. A ordenação dos afixos secundários é dinâmica: quando a coluna AVG está selecionada, as linhas são ordenadas por `|avgDelta|` decrescente; quando uma temporada específica é selecionada, a ordenação passa a ser por `|delta_naquela_temporada|` decrescente, de modo que o afixo de maior impacto na temporada em foco sempre aparece no topo. Em modo multi-dungeon, a ordem é fixada globalmente pela magnitude média entre todas as dungeons selecionadas, para garantir que as linhas se alinhem entre os heatmaps lado a lado.
- A **cor de cada célula** codifica o valor do delta de mediana de keystone (afixo ativo vs. baseline), usando a escala divergente _Red–Yellow–Green_ (`scaleDiverging(interpolateRdYlGn)`) com domínio `[−2, 0, +2]`: valores positivos (dungeon mais fácil, comunidade alcança níveis mais altos quando o afixo está ativo) são mapeados para **verde**; valores negativos (dungeon mais difícil) para **vermelho**; valores próximos de zero para **amarelo**. Deltas fora do intervalo [−2, +2] são truncados nas extremidades da escala. Este canal foi escolhido por sua eficácia para representar dados quantitativos divergentes sobre uma escala com ponto neutro (zero), e pela legibilidade intuitiva da convenção verde/vermelho no contexto de facilidade e dificuldade.

**Estados do Affix Chart:**

- **Sem dungeon selecionada:** exibe o agregado de todas as dungeons e todas as temporadas, dando uma visão geral de quais afixos historicamente tornaram o conteúdo mais acessível ou mais desafiador. Este estado é armazenado em cache (`aggregateAffixCache`) para evitar recarregamento ao deselecionar dungeons.
- **Uma dungeon selecionada:** exibe o heatmap específico para aquela dungeon.
- **Múltiplas dungeons selecionadas:** exibe um heatmap por dungeon, dispostos lado a lado, com as mesmas linhas de afixos e na mesma ordem (afixos ausentes em uma dungeon recebem células nulas), permitindo comparação visual direta entre colunas. A ordem global dos afixos nas linhas é determinada pela magnitude média do impacto em todas as dungeons selecionadas.

**Integração de cor com o Arc Chart:**

A cor de cada célula do heatmap é reutilizada nos rótulos dos afixos exibidos nas _tooltips_ do Arc Chart. Ao inspecionar uma semana no Arc Chart, o usuário visualiza os afixos ativos com a mesma coloração do heatmap, estabelecendo uma **codificação visual compartilhada** entre as duas views e permitindo inferência causal sem troca de contexto.

**Interação:**

- **Clique em uma coluna (temporada) do heatmap:** propaga `selectedSeasonForArc`, sincronizando o Arc Chart para destacar aquela temporada. Esta é uma interação de **seleção cruzada** (_cross-filtering / linked selection_) que fecha o ciclo de análise entre as três views.

### 3.4 Coordenação entre Visões e Redução de Carga Cognitiva

O maior risco de um dashboard com três visões independentes é impor ao usuário o papel de integrador: ele seleciona algo em uma view, precisa lembrar o que selecionou, navegar até outra view, replicar o filtro manualmente e só então comparar os resultados. Cada etapa dessa sequência consome memória de trabalho e aumenta a probabilidade de erro interpretativo.

O sistema evita esse padrão por meio de um estado global compartilhado (`src/state.ts`), composto por apenas dois atributos: `selectedDungeons` e `selectedSeasonForArc`. Qualquer interação que altere esses valores — seja um clique no Dungeon Browser, uma seleção de linha no Arc Chart ou um clique de coluna no Affix Chart — propaga-se automaticamente para todas as demais views via pub/sub. O usuário nunca precisa comunicar sua intenção mais de uma vez.

Essa arquitetura tem também uma consequência menos óbvia: ela define quais perguntas o usuário _pode_ formular. O estado `selectedDungeons` permite tanto a seleção de uma única dungeon (foco em profundidade: como essa dungeon evoluiu?) quanto a seleção múltipla (foco em amplitude: como essas dungeons se comparam entre si?). A mudança entre esses dois modos é implícita — basta clicar em mais uma tile — e todas as views se reconfiguram sem que o usuário precise entender como cada chart individualmente processa a nova seleção.

A consistência de escala reforça essa coordenação no plano visual. O domínio do eixo Y do Arc Chart é calculado globalmente sobre todas as temporadas carregadas e permanece fixo independentemente de qual dungeon ou modo está ativo. Isso significa que a posição vertical de uma linha carrega sempre o mesmo significado quantitativo: o usuário não precisa reaprender a escala a cada troca de contexto, e comparações visuais entre dungeons ou entre temporadas são válidas sem conversão mental. Um mecanismo análogo opera no Affix Chart: a codificação de cor dos afixos é compartilhada com as _tooltips_ do Arc Chart, de modo que o usuário que aprendeu que "verde significa semanas mais fáceis" no heatmap transfere esse conhecimento diretamente para a leitura das tooltips do gráfico de linhas, sem custo adicional de aprendizado.

---

## 4. Implementação

### 4.1 Estrutura do Projeto

O sistema é composto por dois ambientes de execução distintos que não compartilham servidor:

- **Pipeline offline** (`scripts/fetch/`): script Node.js executado uma única vez (`npm run fetch`) para coletar, transformar e persistir os dados da API Blizzard em arquivos Parquet. Utiliza `tsx` para execução direta de TypeScript e o pacote `duckdb` nativo do Node.js para serialização em Parquet.
- **Aplicação web** (`src/`): totalmente estática, sem backend. Os arquivos Parquet são carregados sob demanda pelo navegador via `fetch()` e consultados por DuckDB-Wasm em memória.

### 4.2 Carregamento Lazy de Dados

Os arquivos Parquet são carregados por demanda à medida que o usuário seleciona dungeons de temporadas ainda não carregadas (`loadSeason()` em `src/db/init.ts`). Uma vez carregada, cada season permanece registrada como tabela DuckDB em memória e não é recarregada em interações subsequentes. O mesmo princípio se aplica ao Affix Chart e ao Arc Chart no estado "sem dungeon selecionada": os resultados do agregado sobre todas as temporadas são armazenados em cache (`aggregateAffixCache`, `aggregateArcData`) para que a re-seleção e deseleção de dungeons não provoque recomputação custosa.

### 4.3 Gerenciamento de Estado e Ciclo de Atualização

O módulo `src/state.ts` implementa um pub/sub simples: `setState()` aplica um _patch_ parcial ao estado global e notifica todos os ouvintes registrados via `subscribe()`. Cada módulo de chart registra um callback `render(state)` que é acionado a cada mudança de estado. Para evitar _re-renders_ desnecessários, cada chart compara uma chave de seleção (`lastSelectionKey`) com o estado atual antes de disparar queries ao DuckDB, padrão de **memoização por chave de seleção**.

Uma guarda de concorrência adicional é utilizada nos fluxos assíncronos: após o retorno de queries demoradas, o estado atual é verificado novamente. Se a seleção mudou durante a espera, o resultado é descartado, evitando que dados de uma seleção anterior sobrescrevam o estado visível de uma seleção mais recente.

### 4.4 Cálculo de Escalas

A escala do eixo Y do Arc Chart é calculada uma única vez por `getGlobalKeyRange()`, que computa `MIN` e `MAX` das medianas semanais sobre todas as temporadas carregadas. Esta escala é compartilhada via `setKeyDomain()` em `src/charts/arc-shared.ts` e aplicada uniformemente em todos os modos de renderização do Arc Chart (single, multi e multi por temporada), garantindo comparabilidade visual sem distorção.

O eixo X é re-escalado por temporada: o índice da semana é relativo ao início da temporada (`period_index` = posição ordinal dentro da temporada), não ao período absoluto do dataset. Isso permite sobrepor temporadas de durações diferentes no mesmo espaço horizontal.

### 4.5 Tecnologias

- **D3.js**: toda a renderização de elementos SVG (linhas, eixos, marcadores, tooltips) é realizada via D3, sem uso de bibliotecas de visualização de alto nível.
- **DuckDB-Wasm**: todas as queries de agregação são executadas in-browser contra os arquivos Parquet carregados em memória, eliminando a necessidade de um servidor de dados.
- **TypeScript**: Para tipagens estáticas, facilitando o desenvolvimento e manutenção do código.
- **Vite**: Para o build e servir da aplicação web.

---

## Referências

MUNZNER, Tamara. _Visualization Analysis and Design_. CRC Press, 2014.

Blizzard Entertainment. _Battle.net Developer Portal - Mythic Keystone Leaderboard API_. Disponível em: https://develop.battle.net/documentation/world-of-warcraft/game-data-apis
