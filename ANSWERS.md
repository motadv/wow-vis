# Analytical Q&A — WoW Mythic+ Data Analytics

---

## Q1: What is the difference between Season, Era, and Expansion? How can we analyze a timeline if Mythic+ Keystones were added only in 2016?

These are three distinct concepts that the project conflates informally in some places. Here is a precise treatment of each.

---

### Expansion

An **expansion** is a major product release by Blizzard Entertainment — a packaged update that raises the level cap, adds a new continent or world zone, and introduces a new set of dungeons and raids. Expansions are the primary unit of WoW's design history:

| Expansion                    | Abbrev.      | Release Year |
| ---------------------------- | ------------ | ------------ |
| World of Warcraft (original) | Vanilla      | 2004         |
| The Burning Crusade          | TBC          | 2007         |
| Wrath of the Lich King       | WotLK        | 2008         |
| Cataclysm                    | Cataclysm    | 2010         |
| Mists of Pandaria            | MoP          | 2012         |
| Warlords of Draenor          | WoD          | 2014         |
| Legion                       | Legion       | 2016         |
| Battle for Azeroth           | BfA          | 2018         |
| Shadowlands                  | Shadowlands  | 2020         |
| Dragonflight                 | Dragonflight | 2022         |
| The War Within               | TWW          | 2024         |

Each expansion designed and shipped a specific set of dungeons. Those dungeons are permanently associated with the expansion that created them — that association never changes, regardless of when or how often the dungeon reappears.

---

### Era

In this project, **era** is not a separate concept from expansion — it is the categorical label assigned to a dungeon based on its **expansion of origin**. It answers: _"During which expansion was this dungeon originally designed and released?"_

Era is an attribute of a dungeon, not of time. It does not change. A dungeon designed for Wrath of the Lich King carries `era = "wotlk"` forever, regardless of whether it appears in a 2024 season. The word "era" is used informally in the codebase and in the project spec instead of "expansion of origin" because it reads more naturally in chart labels (`"Legion"`, `"TWW"`) and it conceptually gestures at design philosophy — each expansion had a distinct approach to dungeon design — rather than a product version number.

**Analytically, era is a fixed categorical predictor variable attached to each dungeon.** It is not a temporal axis.

---

### Season

A **season** is a timed competitive period within the Mythic+ system. Seasons are the unit of observation in this dataset. Key properties:

- Each season lasts roughly 5–7 months.
- Each season has a fixed pool of 8 dungeons that are eligible for Mythic+ runs during that period.
- Each season has its own leaderboard, its own affixes, and its own gear reward track.
- Seasons are numbered sequentially within expansions (Legion Season 1, Legion Season 2, etc.), but for analysis purposes they are treated as a global ordered sequence.
- A dungeon that is not in the current season's pool does not appear on any leaderboard during that period — it effectively does not exist competitively.

**Season is the temporal axis of the analysis.** The research questions are answered by comparing dungeon behavior across seasons, not across the full span of WoW history.

---

### The 2016 Problem — and Why It Is Not Actually a Problem

Mythic+ Keystones were introduced in **Legion (2016)**. This is the analytically critical point: dungeons from Vanilla, TBC, WotLK, Cataclysm, MoP, and WoD predate the entire Mythic+ system. They were designed without any notion of keystone scaling, affixes, or time trials.

This creates an apparent paradox: how can you analyze a "timeline" that begins in 2016 when half your dungeon catalog was designed between 2004 and 2014?

The answer is that **the timeline of analysis is the Mythic+ season sequence, not WoW's publication history**. The distinction is fundamental:

| Concept                                | Role in Analysis                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| WoW publication history (2004–present) | Provides the categorical label `era` — a fixed attribute of each dungeon      |
| Mythic+ season sequence (2016–present) | The actual temporal axis — when each dungeon was observed in competitive play |

A Wrath dungeon did not exist in Mythic+ in 2008. It first entered the Mythic+ pool when Blizzard chose to rotate it in — which may have been in a Shadowlands or Dragonflight season, ten or fifteen years after it was originally designed. The dungeon's `era = "wotlk"` label describes its **design origin**, not its first competitive appearance.

This distinction is precisely what makes Question B measurable: there is a defined `first M+ appearance season` — the first time the dungeon ever entered a Mythic+ pool — and there are subsequent `reintroduction seasons`. Those are all within the 2016–present window, observable via the leaderboard API.

**The era label is used as a predictor, not as a time axis.** The research question for Question A is not "how did Wrath dungeons perform in 2008" — that is unanswerable and irrelevant. It is: "when a Wrath dungeon enters the modern Mythic+ rotation, does its era of origin predict its leaderboard activity volume compared to a Dragonflight dungeon entering in the same season?" That is fully answerable from 2016-onward data.

---

### Summary

| Term          | What it is                                    | Role in this project                                                   |
| ------------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| **Expansion** | A major Blizzard product release              | Defines which dungeons exist and when they were designed               |
| **Era**       | Shorthand for a dungeon's expansion of origin | A fixed categorical attribute — the independent variable in Question A |
| **Season**    | A timed competitive period within Mythic+     | The temporal axis of all observations — the unit of measurement        |

The 2016 cutoff is a scope constraint, not an analytical gap. The dataset covers all Mythic+ seasons from Legion onward. Dungeons designed before 2016 appear in the data only from the moment they entered the Mythic+ pool — which is the only moment they are observable as competitive behavior. Their `era` label is simply descriptive metadata about design provenance, carried forward into a modern analytical context.

---

## Q2: Se os dados só refletem entradas no leaderboard, como isso pode avaliar a popularidade de uma dungeon na Era View?

A dúvida aponta para uma tensão real no design analítico do projeto.

### Resposta direta

A Era View **não avalia popularidade geral**. Ela avalia **adoção diferencial entre jogadores de alto nível** — e isso é exatamente o que o dado permite medir. O problema não está na visualização; está em como ela é descrita. Se o texto ou a apresentação usam a palavra "popularidade" sem qualificação, o dado não sustenta essa afirmação.

---

### O que o dado mede de fato

Uma entrada no leaderboard significa que um grupo de 5 jogadores completou aquela dungeon em um nível de keystrone alto o suficiente para aparecer no ranking do seu reino conectado naquele período semanal.

Isso é um proxy para **engajamento competitivo** — não para preferência geral, não para volume total de runs, não para satisfação dos jogadores.

Dentro dessa população específica (key pushers), o número de entradas no leaderboard é uma medida razoável de quais dungeons atraem mais tentativas sérias. Se a dungeon Y tem o dobro de entradas que a dungeon X na mesma temporada, isso indica que mais grupos competitivos escolheram investir tempo nela — seja por gosto, seja por eficiência de recompensa, seja por facilidade de escalar.

---

### O que a Era View pode afirmar com segurança

> "Entre jogadores que aparecem em leaderboards de reino, dungeons originadas da Era X atraíram, em média, N entradas a mais por temporada do que dungeons da Era Y."

Isso é defensável. É uma afirmação sobre comportamento de uma subpopulação bem definida.

---

### O que a Era View **não pode** afirmar

| Afirmação indefensável | Por quê |
|---|---|
| "Dungeons da Era X são mais populares" | Não temos dados do resto da base de jogadores |
| "Jogadores preferem o design da Era X" | Preferência ≠ frequência de runs competitivos |
| "A Era Y produz dungeons menos atrativas" | Pode ser que dungeons da Era Y sejam mais difíceis de cronometrar, não menos desejadas |

---

### O confundimento mais importante que resta

Mesmo dentro da população de leaderboard, o número de entradas confunde dois fenômenos muito diferentes:

- **Dungeons com mais entradas** podem ser mais populares *ou* mais fáceis de completar dentro do timer (o que incentiva mais grupos a tentarem keys mais altas nela).
- **Dungeons com menos entradas** podem ser menos populares *ou* mecanicamente mais difíceis para escalar, reduzindo o número de grupos que atingem o threshold do leaderboard.

Esses dois casos produzem o mesmo sinal no dado — e a Era View não os distingue. Um avaliador vai perguntar exatamente isso.

---

### Como tratar isso na apresentação e no paper

A Era View ainda é analiticamente válida se o texto for preciso. Substituir "popularidade" por **"adoção por jogadores de alto nível"** ou **"volume competitivo"** é suficiente para tornar a afirmação defensável.

A limitação deve ser declarada explicitamente uma vez — preferencialmente no slide de limitações de dados — e não precisa ser repetida a cada gráfico. O que não pode acontecer é usar a visualização para concluir algo que o dado não sustenta.

---

### Resumo

A Era View mede uma coisa real e interessante: como o design de cada era se traduz em engajamento competitivo quando esse conteúdo entra na rotação moderna. Isso não é popularidade geral — é adoção dentro de uma população específica, com um confundimento de dificuldade que não conseguimos isolar com os dados disponíveis. Nomear isso com precisão é o que transforma uma visualização vulnerável em uma contribuição analítica honesta.
