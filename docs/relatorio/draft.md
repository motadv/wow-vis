# Análise de Balanceamento de Dungeons Mythic+ de World of Warcraft por Visualização de Dados

## Trabalho 02 Visualização de Dados

## Aluno: Rodrigo Sodré

## Professor: Marcos Lage

# Escolhas de Design e Interações com base no Framework de 3 níveis de Tamara Munzner

> O relatório deve justificar suas escolhas de design e interações com base no framework de três níveis de Tamara Munzner:

## What (Data):

> Identifique os tipos de datasets e atributos. Descreva as transformações realizadas nos dados brutos (ex: agregação, filtragem, derivação de novos atributos) e a respectiva justificativa.

- Dataset público da Blizzard desponível via API gratúita sob cadastro no site deles. Dados coletados e processados armazenados nos arquivos parquet em public/data/. O arquivo dungeons.json é um arquivo de configuração que define as Dungeons e suas temporadas. O arquivo affixes.json é um arquivo de configuração que define os afixos e suas temporadas. Os arquivos season-\*.parquet são os arquivos de dados que contêm os dados das temporadas.

- Transformações e processamentos [VER SCRIPT fetch E DESCREVER AQUI].
- Explicitar que não estamos usando dados de seasons pré Battle for Azeroth pois não conseguimos buscar os dados na API, não disponíveis.
- Explicitar que não estamos usando dados pós Dragonflight Season 4 pois houveram alterações no sistema de dungeons e afixos, o sistema de visualização não comportaria as mudanças, ficando complexo para o usuário entender as nuances de cada mudança.
- Explicitar que as seasons 1 de Shadowlands e 1 de Dragonflight estão desabilitadas do sistema porque a coleta de dados só retornou 1 período de dados, não sendo possível traçar uma linha de evolução para elas e gerando apenas outliers.

## Why (Task):

> Defina as tarefas específicas que o sistema pretende suportar, justificando a necessidade de visões coordenadas para a resolução dos problemas propostos. Em suas justificativas, explore o conceito de Ação e Alvo na descrição de tarefas.

### Tasks:

[Melhorar aqui a descrição das tasks seguindo o framework da Tamara Munzner]
[Analisar as views disponíveis e propor novas tasks que se encaixem no sistema que temos]

- Quais dungeons foram mais difíceis/fáceis em cada temporada?
- Como o desempenho dos jogadores nessa dungeon mudou em cada season que ela aparece?
- Como os afixos da rotação atual afetam o desempenho do jogador em cada dungeon?
- Quais afixos influenciam na dificuldade de cada dungeon em cada season/semana?
- Comparação entre o impacto dos afixos primários e secundários em diferentes dungeons.
- Comparando N dungeons em uma mesma season, como os afixos influenciam na dificuldade das dungeons?
- Identificar em quais seasons uma dungeon aparece

## How (Design):

> Justifique o design visual utilizando o Ranking de Eficácia de Canais (Munzner). Explique a escolha dos marcadores, canais visuais, mecanismos de interação e como a coordenação entre as visões reduz a carga cognitiva do usuário. Explore também a Taxonomia de Interações.

### Dungeon Browser

- Explicar que o Dungeon Browser já separa as dungeons por seasons ordenadas por mais difíceis e fáceis.
- Hover aciona uma tooltip com mais informações sobre aquela dungeon naquela season, como a key mediana alcançada.
- Falar da legenda por expansão que ajuda quem tem conhecimento do domínio do WoW a identificar mais rapidamente a dungeon pela abreviação do nome + cor da expansão.
- Falar da barra de pesquisa que faz highlight das dungeons pelo nome completo delas.
- Falar da separação das seasons por Era do WoW para facilitar a separação visual e conceitual das temporadas.
- Falar que o hover em uma dungeon faz highlight nas outras instancias daquela dungeon em outras temporadas, mantendo a season delas acesa enquanto apaga as outras para facilitar identificar em quais seasons a dungeon apareceu.

## Arc Chart

Falar das diferentes views disponíveis:

### single dungeon

- o eixo Y representa a key mediana.
- o eixo X representa as semanas.
- as linhas coloridas são os dados daquela dungeon naquela temporada.
- Uma linha vertical pontilhada e com baixa opacidade para não poluir visualmente representa última semana daquela temporada com a label da temporada.
- Um marcador em bolinha em cada ponto que identifica uma semana ajuda a determinar quais são os pontos de interesse entre a interpolação da linha.
- Passar o mouse sobre o gráfico quando nenhuma linha (season) está selecionada mostra uma tooltip com key mediana daquela semana e quais afixos estavam presentes para cada season presente no gráfico.
- Clicar em uma linha (season) seleciona ela, mantendo ela desenhada em destaque e acendendo uma linha horizontal pontilhada indicando a mediana ou média [VERIFICAR NO CODIGO] daquela dungeon naquela season, facilitanto a visão se naquela semana o desempenho dos jogadores foi melhor ou pior do que a média.
- Quando uma linha (season) está selecionada a tooltip mostra as mesmas informações porém com a mediana ou média [VERIFICAR NO CODIGO] daquela dungeon naquela season em destaque para facilitar a comparação.

### multi dungeon

- Em destaque aparecem uma linha para cada dungeon selecionada mostrando o desempenho geral daquela dungeon em todas as seasons que ela apareceu (agregado).
- Ao passar o mouse sobre o gráfico, uma tooltip aparece indicando a key mediana geral (agregado) de todas as dungeons selecionadas naquela semana (ordenada na season, não absoluta, então a semana 1 é a primeira semana de uma season e não a semana 1 do dataset) e uma comparação de quanto as dungeons estão abaixo da mais fácil/mais completada (mais alta no gráfico).
- Linhas não interagíveis com menor opacidade e destaque aparecem representando as diferentes seasons que as dungeons dividem, quando o usuário seleciona uma season pelo botão, apenas ela é renderizada em destaque.
- Caso as dungeons selecionadas tenham seasons em comum, botões para cada season aparecerão acima do gráfico. Selecionar um desses botões seleciona a temporada e muda a visualização para multi dungeon comparison por temporada.

### multi dungeon comparison por temporada

- O gráfico agora permite que o usuário veja a progressão da key mediana para cada dungeon selecionada, naquela temporada específica. visualizando em que momentos a dungeon foi mais difícil ou mais fácil e comparando entre elas.
- Passar o mouse sobre o gráfico mostra uma tooltip indicando a key mediana de cada dungeon selecionada naquela semana (ordenada na season, não absoluta, então a semana 1 é a primeira semana de uma season e não a semana 1 do dataset) e quais afixos estavam ativos para cada uma das dungeons selecionadas.

Deixar claro que as escalas se mantém entra todas essas views de arc para permitir a comparação visual dos gráficos sem distorcer as proporções encolhendo ou esticando os eixos X e Y.

## Affix Chart

Um heatmap onde as colunas representam as seasons com uma adicional com a média agregada de todas as seasons que a dungeon aparece, e as linhas os afixos de dungeons. -

- Cada célula representa o impacto dos afixos em em relação a key mediana da dungeon naquela season [VERIFICAR NO CODIGO].
- Há um heatmap por dungeon selecionada, dispostos lado a lado e com os mesmos número e ordenação dos eixos para facilitar a comparação visual entre as dungeons.
- Quando nenhuma dungeon é selecionada, o gráfico mostra um agregado para todas as dungeons, mostrando como cada afixo impacta na dificuldade geral das dungeons.
