# Review `feature/collector` (`47ae36a`)

## Resultado

`feature/collector` NÃO está liberada para merge.

Bloqueadores:

- Dimensão `schools` está quebrada contra a API real: `/public/portal/filters?county=...` retorna `regionals` globais, o código entra no ramo multi-regional e ignora `countyFilters.schools`, então escolas válidas podem não ser gravadas.
- Escola sem município mapeado não vira apenas `city: null`: o insert de oportunidade quebra por FK `opportunities.id_school -> schools.id_school`.
- Modo incremental para no primeiro `externalId` conhecido antes de atualizar detalhe/itens/anexos; qualquer processo conhecido alterado na fonte fica desatualizado.
- Cobertura crítica não prova Drizzle real, resiliência HTTP real, 429/rate-limit, nem refresh seguro.

## 1. Contrato

`src/lib/contracts/opportunity.ts` bate BYTE A BYTE com a especificação canônica.

Comando:

```bash
node - <<'NODE'
...
NODE
```

Resultado:

```json
{"byteEqual":true,"actualBytes":1315,"canonicalBytes":1315}
```

Divergências: nenhuma.

## BLOQUEIA MERGE

### 1. Dimensão `schools` falha com resposta real de `/public/portal/filters`

Arquivo: `src/lib/collector/collect.ts:250`, `src/lib/collector/collect.ts:254`, `src/lib/collector/collect.ts:258`, `src/lib/collector/collect.ts:275`

Errado:

- Código busca filtros base, itera `counties`, depois chama `/public/portal/filters?county=<idCounty>`.
- Se `countyFilters.regionals.length > 1`, código ignora `countyFilters.schools` e tenta refinar por cada regional.
- Smoke real mostrou que `county=2725` retorna `regionals: 48` e `schools: 1`.
- Smoke real mostrou que `county=2725&regional=157` retorna `schools: 0`.
- Resultado concreto: `EE PEDRO ALVARES CABRAL` aparece em `county=2725`, mas fluxo atual cai no ramo multi-regional e não grava essa escola.

Quebra em produção:

- Muitas escolas não entram em `schools`.
- Oportunidades dessas escolas falham no insert por FK ou ficam sem cidade/regional.
- Produto não entrega card com cidade confiável.

Evidência live, 5 requests reais no total na auditoria:

- `GET /public/purchase-orders?portalSlug=mg&pageSize=5&page=1&sortBy=dtPurchaseOrder&sortDir=DESC`: HTTP 200, `x-ratelimit-limit: 200`, `x-ratelimit-remaining: 198`, 5 registros, ordenados por `purchaseDate` desc.
- `GET /public/portal/filters?portalSlug=mg`: HTTP 200, `x-ratelimit-limit: 60`, `x-ratelimit-remaining: 58`, `counties: 850`, `regionals: 48`, `schools: 3400`.
- `GET /public/portal/filters?portalSlug=mg&county=2725`: HTTP 200, `x-ratelimit-remaining: 57`, `counties: 1`, `regionals: 48`, `schools: 1`, primeira escola `idSchool: 10888`.
- `GET /public/portal/filters?portalSlug=mg&county=2725&regional=1`: HTTP 200, `schools: 0`.
- `GET /public/portal/filters?portalSlug=mg&county=2725&regional=157`: HTTP 200, `schools: 0`.

### 2. Escola sem município mapeado quebra insert, apesar de `city` nullable

Arquivo: `src/lib/collector/collect.ts:302`, `src/lib/collector/collect.ts:324`, `src/lib/db/schema.ts:54`, `src/lib/db/schema.ts:56`, `src/lib/collector/collect.ts:540`

Errado:

- `buildOpportunityRecord` aceita `repository.getSchool(...)` retornar `null` e grava `city: null`.
- Mas `opportunities.idSchool` é `notNull().references(() => schools.idSchool)`.
- `DrizzleCollectorRepository.upsertOpportunity` insere `idSchool` sem garantir linha correspondente em `schools`.

Quebra em produção:

- Se dimensão `schools` falhar, estiver incompleta, ou `refreshSchools=false`, oportunidade não vira card com `city: null`; o insert falha por foreign key.
- Requisito "escola sem município mapeado vira `city: null` sem quebrar" não está atendido.

### 3. Incremental deixa registro conhecido desatualizado para sempre

Arquivo: `src/lib/collector/collect.ts:170`, `src/lib/collector/collect.ts:171`, `src/lib/collector/collect.ts:185`, `src/lib/collector/collect.ts:186`, `src/lib/collector/collect.ts:187`

Errado:

- Ordenação incremental usa `sortBy: "dtPurchaseOrder"` e `sortDir: "DESC"`.
- Ao encontrar `externalId` conhecido, o coletor para antes de buscar `detail`, `items` e `attachments`.
- Registro conhecido nunca é atualizado em modo incremental.

Caso concreto:

- Processo já coletado muda `purchaseOrderStatus`, `dtDelivery`, anexo, fornecedor ou itens na fonte.
- Próxima coleta incremental encontra o mesmo `externalId` no topo ou antes da alteração antiga, para, e mantém banco antigo.

Quebra em produção:

- Card mostra prazo/status/itens defasados indefinidamente.
- "Parar ao bater conhecido" só é seguro se a fonte for append-only imutável; ela não foi provada assim.

### 4. Cobertura reportada não prova idempotência real do upsert

Arquivo: `tests/collector.test.ts:46`, `tests/collector.test.ts:83`, `tests/collector.test.ts:84`, `tests/collector.test.ts:312`, `tests/collector.test.ts:344`, `src/lib/collector/collect.ts:538`, `src/lib/collector/collect.ts:601`

Errado:

- Teste de idempotência usa `FakeRepository`, um `Map` em memória.
- Não executa `DrizzleCollectorRepository`.
- Não prova `onConflictDoUpdate`, unique index real, FK real, delete real de `items`/`attachments`, nem ausência de duplicata em banco.
- Também não verifica anexos duplicados após segunda coleta.

O que o teste realmente assegura:

- `collectOpportunities` chama páginas 1 e 2.
- `FakeRepository.opportunities.set(externalId, opportunity)` sobrescreve chave no `Map`.
- Para um registro, array `items` tem 2 itens depois de duas execuções.

O que não assegura:

- Rodar coleta 2x no Postgres não duplica `opportunities`.
- Rodar coleta 2x no Postgres não duplica `items`.
- Rodar coleta 2x no Postgres não duplica `attachments`.
- Linhas filhas são substituídas de forma transacional.

Prova estática do código:

- Upsert de oportunidade é por `externalId`: `src/lib/collector/collect.ts:569`, `src/lib/db/schema.ts:82`.
- Itens são apagados antes de reinserir: `src/lib/collector/collect.ts:601`.
- Anexos são apagados antes de reinserir: `src/lib/collector/collect.ts:602`.
- Portanto, em caminho feliz, não acumula duplicados; substitui filhos.
- Mas não há transação envolvendo parent/delete/insert: falha entre delete e insert deixa oportunidade sem itens/anexos ou parcialmente atualizada.

## CORRIGIR ANTES DE PRODUÇÃO

### 5. Cliente HTTP não tem teste de 429, headers de rate limit, timeout ou retry real

Arquivo: `src/lib/collector/client.ts:212`, `src/lib/collector/client.ts:221`, `src/lib/collector/client.ts:227`, `src/lib/collector/client.ts:285`, `src/lib/collector/client.ts:301`, `tests/collector.test.ts:144`, `tests/collector.test.ts:150`

Errado:

- Teste de "5xx" injeta `new Error("Caixa Escolar API returned 500")` no `FakeClient`.
- Não passa por `CaixaEscolarClient`.
- Não verifica `fetch`, `Response.status`, `SourceHttpError`, retry, backoff, timeout, `x-ratelimit-*`, nem `User-Agent`.

O código tem:

- `User-Agent` identificável: `src/lib/collector/client.ts:4`, `src/lib/collector/client.ts:291`.
- Timeout via `AbortController`: `src/lib/collector/client.ts:285`.
- Backoff exponencial: `src/lib/collector/client.ts:313`.
- Retry para `429` e `>=500`: `src/lib/collector/client.ts:221`.
- Leitura parcial de rate limit: `x-ratelimit-remaining` e `x-ratelimit-reset`: `src/lib/collector/client.ts:301`.

Risco:

- `Retry-After` é exposto pela API, mas cliente não lê esse header.
- Cliente só dorme quando `remaining <= 0`; não molda ritmo antes disso.
- Sem teste, regressão pode virar martelada em 429/5xx ou retry errado.

### 6. Schema não mantém índice `deadline` nem `status` pedido no briefing

Arquivo: `src/lib/db/schema.ts:65`, `src/lib/db/schema.ts:67`, `src/lib/db/schema.ts:90`, `src/lib/db/schema.ts:91`, `src/lib/db/schema.ts:92`, `drizzle/0001_curly_lady_deathstrike.sql:25`, `drizzle/0001_curly_lady_deathstrike.sql:26`, `drizzle/0001_curly_lady_deathstrike.sql:89`, `drizzle/0001_curly_lady_deathstrike.sql:90`

Errado:

- `drizzle/0001` remove `deadline` e `status`.
- Índices `opportunities_deadline_idx` e `opportunities_status_idx` são removidos.
- Schema final tem `purchase_date`, `purchase_order_status`, `accountability_status`, mas não campo comercial `deadline`.

Índices existentes:

- `external_id`: unique index existe em `src/lib/db/schema.ts:82`.
- `city`: existe em `src/lib/db/schema.ts:86`.
- `category_id`: existe em `src/lib/db/schema.ts:89`.
- `deadline`: não existe.
- `status`: não existe como campo de oportunidade; existem índices por `purchase_order_status` e `accountability_status`.

Quebra em produção:

- Busca/ordenação por prazo comercial do card não tem coluna/index dedicado.
- Se UI/API espera `deadline`/`status` genéricos, migration quebrou contrato antigo.

### 7. Campo de cidade é objetivo central do card, mas teste não cobre escola sem município

Arquivo: `tests/collector.test.ts:185`, `tests/collector.test.ts:217`, `tests/collector.test.ts:218`, `src/lib/collector/collect.ts:324`

Errado:

- Teste cobre só caminho feliz com `FakeClient` que devolve escolas bem mapeadas.
- Não existe caso `getSchool` retornando `null`.
- Não existe caso realista em que `countyFilters.regionals` tem 48 regionais e `schools` já vem no filtro de county.

Quebra em produção:

- Falha de mapeamento de cidade passa despercebida.
- Produto pode ficar sem cidade ou nem gravar oportunidades.

### 8. Persistência de card comercial está incompleta

Arquivo: `src/lib/contracts/opportunity.ts:53`, `src/lib/contracts/opportunity.ts:54`, `src/lib/contracts/opportunity.ts:55`, `src/lib/contracts/opportunity.ts:56`, `src/lib/db/schema.ts:46`, `src/lib/collector/collect.ts:62`

Errado:

- Contrato canônico tem `category`, `headline`, `summary`, `topItems`.
- `OpportunityRecord` e tabela `opportunities` não persistem `headline`, `summary` ou `topItems`.
- `categoryId` existe, mas collector não classifica nem popula `categoryId`.

Quebra em produção:

- Fornecedor precisa card simples com categoria, resumo e principais itens.
- Esta branch coleta dados brutos e itens, mas ainda não entrega o formato comercial completo.

## MELHORIA

### 9. Upsert de oportunidade e filhos precisa transação

Arquivo: `src/lib/collector/collect.ts:538`, `src/lib/collector/collect.ts:601`, `src/lib/collector/collect.ts:606`, `src/lib/collector/collect.ts:624`

Errado:

- Upsert parent, delete de filhos e insert de filhos rodam sem `transaction`.

Caso concreto:

- Falha no insert de `attachments` após delete deixa oportunidade atualizada com itens novos e anexos vazios.
- Falha no insert de `items` após delete deixa oportunidade sem itens.

Impacto:

- Mesmo sem duplicar, idempotência não é atômica.

### 10. `collectSchoolDimension` pode fazer volume enorme de requests

Arquivo: `src/lib/collector/collect.ts:250`, `src/lib/collector/collect.ts:254`, `src/lib/collector/collect.ts:258`, `src/lib/collector/collect.ts:259`

Errado:

- Smoke real base retornou 850 municípios e 48 regionais.
- Ramo atual pode fazer aproximadamente `1 + 850 + 850 * 48` chamadas se cada county carregar regionais globais.

Impacto:

- Mesmo respeitando rate limit, refresh total de escolas fica lento e frágil.
- Aumenta chance de 429/5xx em coleta normal.

## 2. Cobertura real dos 7 cenários exigidos

1. Paginação: COBERTO em parte. `tests/collector.test.ts:46` a `tests/collector.test.ts:91` cobre paginação de listagem e itens via `FakeClient`.
2. Upsert idempotente: NÃO COBERTO de forma suficiente. `tests/collector.test.ts:46` a `tests/collector.test.ts:84` cobre só `FakeRepository` com `Map`; não cobre Drizzle/Postgres, itens/anexos reais ou transação.
3. Campo nulo: COBERTO. `tests/collector.test.ts:94` a `tests/collector.test.ts:139` cobre campos nulos de listagem/detalhe.
4. Item com `nuValueByItem` null: COBERTO. `tests/collector.test.ts:110` a `tests/collector.test.ts:140` cobre `unitValue: null` e `totalValue: null`.
5. Anexo com `url` vazia: COBERTO. `tests/collector.test.ts:118` e `tests/collector.test.ts:141` cobrem `url: ""` virando `null`.
6. Erro 5xx da fonte: NÃO COBERTO de forma suficiente. `tests/collector.test.ts:144` a `tests/collector.test.ts:167` cobre só erro lançado por `FakeClient`; não cobre resposta HTTP 500, retry/backoff, `SourceHttpError`, nem rate limit.
7. Resposta vazia: COBERTO. `tests/collector.test.ts:169` a `tests/collector.test.ts:182` cobre listagem vazia sem busca de detalhe e sem gravação.

Contagem real:

- 6 testes em 2 arquivos.
- 5 testes novos de collector.
- 1 teste antigo de schema só verifica `raw_json`.
- "6 passed" prova esses asserts, não prova prontidão de produção.

## 3. Idempotência do upsert

Resposta:

- Upsert de oportunidade é por `externalId`.
- Em caminho feliz, rodar coleta 2x não deve duplicar oportunidade, item ou anexo no Drizzle, porque filhos são deletados e reinseridos.
- Itens são substituídos, não acumulados.
- Anexos são substituídos, não acumulados.

Prova:

- Unique index: `src/lib/db/schema.ts:82`.
- `onConflictDoUpdate` target `opportunities.externalId`: `src/lib/collector/collect.ts:569`.
- Delete de `items` por `opportunityId`: `src/lib/collector/collect.ts:601`.
- Delete de `attachments` por `opportunityId`: `src/lib/collector/collect.ts:602`.
- Unique filhos: `src/lib/db/schema.ts:115` e `src/lib/db/schema.ts:134`.

Falha restante:

- Sem transação, idempotência não é atômica.
- Teste não prova comportamento real em banco.

## 4. Dimensão `schools` / cidade

Resposta:

- Construção via `/public/portal/filters` está implementada, mas não funciona corretamente contra forma observada da API.
- Escola sem município mapeado não fica apenas `city: null` sem quebrar; FK exige escola em `schools`.
- Cidade é campo obrigatório do produto; branch não resolve risco.

## 5. Rate limit e resiliência

Resposta:

- Não há código que burle rate limit.
- Cliente lê `x-ratelimit-remaining` e `x-ratelimit-reset`.
- Cliente não usa `Retry-After`.
- Cliente dorme só quando `remaining <= 0`, não controla ritmo por `x-ratelimit-limit`.
- Backoff é exponencial: `initialBackoffMs * 2 ** attempt`.
- Timeout existe via `AbortController`.
- 429 e 5xx têm retry até `maxRetries`.
- User-Agent identificável existe.
- Teste não cobre nada disso no client real.

## 6. Modo incremental

Resposta:

- Parar ao bater registro conhecido não é seguro.
- Registro antigo ou conhecido atualizado na fonte fica desatualizado.
- Ordenação usada é `dtPurchaseOrder DESC`.

## 7. Schema e migration

Resposta:

- Campos reais de `research/portal/schema.md` estão representados para listing/detail/item/attachment, com `raw_json` preservado.
- `raw_json` existe em `opportunities`, `items`, `attachments`, `schools`.
- Índices `external_id`, `city`, `category_id` existem.
- Índices `deadline` e `status` não existem no schema final; migration remove ambos.
- `delivery_date`, `proposal_date`, `purchase_order_status`, `accountability_status` existem, mas isso não é byte-equivalente ao requisito "deadline/status".

## 8. Testes e rede

Resposta:

- Testes não tocam a rede.
- `tests/collector.test.ts` usa `FakeClient`.
- Não há `fetch`, `CaixaEscolarClient`, `msw`, `nock`, `undici`, `global.fetch` nos testes.
- Fixtures são lidas de `../../research/portal/fixtures`.

## Comandos rodados

```bash
git status --short --branch
git rev-parse --abbrev-ref HEAD && git rev-parse HEAD
rg --files
nl -ba src/lib/contracts/opportunity.ts
nl -ba src/lib/collector/client.ts
nl -ba src/lib/collector/collect.ts
nl -ba src/lib/db/schema.ts
nl -ba tests/collector.test.ts
nl -ba tests/schema.test.ts
nl -ba drizzle/0000_exotic_hedge_knight.sql
nl -ba drizzle/0001_curly_lady_deathstrike.sql
nl -ba /Users/haza/Desktop/Projetos/LPA_Leo/research/portal/schema.md
corepack pnpm test -- --run
corepack pnpm typecheck
corepack pnpm lint
curl --max-time 20 --silent --show-error --include --user-agent 'lpa-leo-collector-review/0.1 contato:fornecedores' 'https://transparencia-api.caixaescolar.educacao.mg.gov.br/public/purchase-orders?portalSlug=mg&pageSize=5&page=1&sortBy=dtPurchaseOrder&sortDir=DESC'
node - <<'NODE'
// 2 requests: filters base + filters county=2725
NODE
node - <<'NODE'
// 1 request: filters county=2725&regional=1
NODE
node - <<'NODE'
// 1 request: filters county=2725&regional=157
NODE
```

Resultados:

- Branch: `feature/collector`.
- HEAD: `47ae36a68b05aab95d5ab9b18981c2208f7cdae3`.
- Worktree antes do report: sem alterações rastreadas; havia `?? .codex/` preexistente.
- `corepack pnpm test -- --run`: passou, `2 passed (2)`, `6 passed (6)`.
- `corepack pnpm typecheck`: passou.
- `corepack pnpm lint`: passou.
- Smoke API: 5 requests reais no total, todos HTTP 200, sem 429.

## Re-review 2026-08-12

### Veredito

`feature/collector` ainda NÃO está liberada para merge sem decisão do dono do produto.

Bloqueadores originais 1, 2, 4, 5, 6, 7, 8 e transação foram corrigidos e verificados. Ponto ainda parcial: `refreshStale` existe e re-coleta em teste unitário, mas TTL de 7 dias não tem teste Postgres direto; validação Postgres cobre upsert/FK/rollback, não stale query.

### 1. Dimensão `schools`: RESOLVIDO

Evidência de código:

- `src/lib/collector/collect.ts:332` a `src/lib/collector/collect.ts:349`: ramo de refino por regional foi apagado.
- Fluxo atual faz `base -> county`, usa `countyFilters.schools`, grava `regional: null`.
- `tests/collector.test.ts:186` a `tests/collector.test.ts:219`: teste simula `regionals: 48` e prova chamadas `["base", "county:1", "county:2"]`; nenhuma chamada `county:*:regional:*`.

Smoke real, 2 requests, sem 429:

```json
{
  "base": {
    "status": 200,
    "limit": "60",
    "remaining": "58",
    "reset": "1",
    "counties": 850,
    "regionals": 48,
    "schools": 3400
  },
  "county2725": {
    "status": 200,
    "limit": "60",
    "remaining": "57",
    "reset": "1",
    "counties": 1,
    "regionals": 48,
    "schools": 1,
    "captures10888": true,
    "school10888": {
      "idSchool": 10888,
      "txName": "EE PEDRO ALVARES CABRAL"
    }
  }
}
```

Conclusão: `EE PEDRO ALVARES CABRAL` (`idSchool 10888`) agora entra pelo array `countyFilters.schools`; bug antigo descartava essa escola ao entrar no ramo regional.

Regressão controlada:

- Antes, fake test atribuía `regional` quando havia 1 regional.
- Agora `regional` sempre fica `null` na dimensão coletada por county.
- Produto precisa cidade; cidade voltou. Regional ficou sem mapeamento confiável porque endpoint real retorna 48 regionais globais por county.

Volume de requests:

- Antes: `1 + 850 + 850 * 48 = 41.651` requests no pior caso observado.
- Agora: `1 + 850 = 851` requests para refresh completo de municípios observados.

### 2. Stub de FK / escola sem município: RESOLVIDO

Evidência de código:

- `src/lib/db/schema.ts:33` e `src/lib/db/schema.ts:34`: `schools.id_county` e `schools.city` agora nullable.
- `src/lib/collector/collect.ts:613` a `src/lib/collector/collect.ts:623`: `upsertOpportunity` cria stub em `schools` com `idCounty: null`, `city: null`, `regional: null` antes de inserir oportunidade.
- FK continua honrada: `src/lib/db/schema.ts:54` a `src/lib/db/schema.ts:56`.

Prova em Postgres real:

- `TEST_DATABASE_URL='postgres://lpa:lpa@localhost:5432/lpa_leo_test' corepack pnpm test tests/collector-db.test.ts -- --run`: passou, `2 tests`.
- Query pós-teste:

```json
{
  "counts": {
    "opportunities": 1,
    "items": 2,
    "attachments": 2,
    "schools": 1
  },
  "school": {
    "id_school": 9458,
    "name": "EE CORONEL ARISTIDES BATISTA",
    "id_county": null,
    "city": null,
    "regional": null
  },
  "opportunity": {
    "id_school": 9458,
    "city": null,
    "purchase_order_status": "ENVD"
  }
}
```

Conclusão: escola sem município entra como stub, FK não quebra, oportunidade fica com `city: null`.

Risco restante:

- Se stub entra primeiro e dimensão real chega depois, `schools.city` atualiza, mas `opportunities.city` continua `null` até a oportunidade ser re-coletada.

### 3. Incremental e `refreshStale`: PARCIAL

Incremental: RESOLVIDO.

- `src/lib/collector/collect.ts:191` a `src/lib/collector/collect.ts:207`: registro conhecido agora é atualizado; não para antes de `detail/items/attachments`.
- `src/lib/collector/collect.ts:222` a `src/lib/collector/collect.ts:226`: contador para só quando `pagesWithoutNew >= 3`.
- `tests/collector.test.ts:221` a `tests/collector.test.ts:253`: 3 páginas conhecidas são processadas, `detailCalls === 3`, página 4 não é buscada. Sem off-by-one para contrato "parar após 3 páginas consecutivas sem novo".

`refreshStale`: PARCIAL.

- `src/lib/collector/collect.ts:259` a `src/lib/collector/collect.ts:263`: default `olderThanDays = 7`.
- `src/lib/collector/collect.ts:277` a `src/lib/collector/collect.ts:282`: calcula cutoff e chama `listStaleOpportunityListings(cutoff, maxRecords)`.
- `src/lib/collector/collect.ts:288` a `src/lib/collector/collect.ts:295`: stale record passa por `buildOpportunityRecord`, então re-busca `detail`, `items` e `attachments`.
- `src/lib/collector/collect.ts:727` a `src/lib/collector/collect.ts:755`: Drizzle filtra `opportunities.collectedAt < cutoff`.
- `tests/collector.test.ts:255` a `tests/collector.test.ts:269`: prova unitária de re-coleta via `refreshStale`, mas fake repository ignora o cutoff.

Falta:

- Teste Postgres real de `listStaleOpportunityListings`: registro com `collected_at` de 8 dias aparece; registro com `collected_at` recente não aparece.
- Teste Postgres real de `refreshStale` atualizando registro velho end-to-end.

### 4. Testes de banco / idempotência / rollback: RESOLVIDO

Evidência:

- `tests/collector-db.test.ts:22` e `tests/collector-db.test.ts:23`: usa `TEST_DATABASE_URL` ou default `postgres://lpa:lpa@localhost:5432/lpa_leo_test`.
- `tests/collector-db.test.ts:57` a `tests/collector-db.test.ts:63`: faz `select 1`; se conexão falha, lança erro. Não há skip silencioso.
- `tests/collector-db.test.ts:76` a `tests/collector-db.test.ts:104`: coleta 2x e verifica `opportunities=1`, `items=2`, `attachments=2`, `schools=1`, stub com cidade nula.
- `tests/collector-db.test.ts:106` a `tests/collector-db.test.ts:137`: força falha de insert de anexo (`filename: null`), verifica rollback real: contagens antigas preservadas e `purchaseOrderStatus` continua `ENVD`, não `APRO`.
- `src/lib/collector/collect.ts:605` a `src/lib/collector/collect.ts:724`: transação envolve stub school, upsert parent, delete de `items`, delete de `attachments`, insert de filhos.

Comandos:

```bash
TEST_DATABASE_URL='postgres://lpa:lpa@localhost:5432/lpa_leo_test' corepack pnpm test tests/collector-db.test.ts -- --run
```

Resultado: `1 passed (1)`, `2 passed (2)`.

```bash
TEST_DATABASE_URL='postgres://lpa:lpa@localhost:5432/lpa_leo_test' corepack pnpm test -- --run
```

Resultado: `4 passed (4)`, `14 passed (14)`.

Skip escondido:

- `rg -n "\.(skip|todo|only)\(" tests || true`: sem saída.
- Suíte completa mostra 14 testes passados, nenhum skip.

Nota de auditoria:

- Primeira tentativa inválida rodou suíte completa e `collector-db.test.ts` em paralelo; ambas fazem `drop schema public` no mesmo `lpa_leo_test`, então houve colisão. Reexecução sequencial limpa passou. Isso não invalida branch, mas mostra que rodar dois comandos DB simultâneos não é seguro.

### 5. Rate limit, Retry-After, 429/500/timeout: RESOLVIDO

Evidência de código:

- `src/lib/collector/client.ts:322` a `src/lib/collector/client.ts:327`: `Retry-After`, `x-ratelimit-reset` e backoff exponencial entram no `Math.max`.
- `src/lib/collector/client.ts:304` a `src/lib/collector/client.ts:319`: ritmo modulado por `x-ratelimit-limit` e `x-ratelimit-reset`, não só por `remaining <= 0`.
- `src/lib/collector/client.ts:287` a `src/lib/collector/client.ts:301`: timeout com `AbortController`.
- `src/lib/collector/client.ts:292` a `src/lib/collector/client.ts:296`: `User-Agent` e `Accept`.

Testes:

- `tests/client.test.ts:20` a `tests/client.test.ts:39`: 429 com `Retry-After: 2` dorme `2000`.
- `tests/client.test.ts:41` a `tests/client.test.ts:64`: HTTP 500 repete com backoff `25` e verifica headers.
- `tests/client.test.ts:66` a `tests/client.test.ts:87`: aborta no timeout configurado.
- `tests/client.test.ts:89` a `tests/client.test.ts:115`: modula ritmo por `x-ratelimit-limit: 60` e `x-ratelimit-reset: 1`.

Comando:

```bash
TEST_DATABASE_URL='postgres://lpa:lpa@localhost:5432/lpa_leo_test' corepack pnpm test tests/client.test.ts -- --run
```

Resultado: `1 passed (1)`, `4 passed (4)`.

### 6. `delivery_date` / fantasma `deadline`: RESOLVIDO

Evidência:

- `src/lib/db/schema.ts:94`: índice `opportunities_delivery_date_idx`.
- `drizzle/0002_ordinary_proemial_gods.sql:6`: comentário documenta que API não expõe `deadline` genérico; consultas comerciais usam `delivery_date`.
- `drizzle/0002_ordinary_proemial_gods.sql:7`: cria índice em `delivery_date`.

Prova em Postgres real:

```json
{
  "indexes": [
    {
      "indexname": "opportunities_category_id_idx"
    },
    {
      "indexname": "opportunities_delivery_date_idx"
    }
  ]
}
```

`opportunities_deadline_idx` não existe, agora documentado como decisão.

### 7. Colunas comerciais nullable: RESOLVIDO

Evidência de código:

- `src/lib/db/schema.ts:76`: `categoryId` nullable.
- `src/lib/db/schema.ts:77`: `headline` nullable.
- `src/lib/db/schema.ts:78`: `summary` nullable.
- `src/lib/db/schema.ts:79`: `topItems` nullable.
- `drizzle/0002_ordinary_proemial_gods.sql:3` a `drizzle/0002_ordinary_proemial_gods.sql:5`: migration adiciona colunas sem `NOT NULL`.

Prova em Postgres real:

```json
{
  "columns": [
    { "column_name": "category_id", "is_nullable": "YES" },
    { "column_name": "delivery_date", "is_nullable": "YES" },
    { "column_name": "headline", "is_nullable": "YES" },
    { "column_name": "summary", "is_nullable": "YES" },
    { "column_name": "top_items", "is_nullable": "YES" }
  ]
}
```

### 8. Transação pai + filhos: RESOLVIDO

Evidência:

- `src/lib/collector/collect.ts:605`: `this.database.transaction`.
- `src/lib/collector/collect.ts:613` a `src/lib/collector/collect.ts:623`: stub `schools`.
- `src/lib/collector/collect.ts:626` a `src/lib/collector/collect.ts:687`: upsert `opportunities`.
- `src/lib/collector/collect.ts:689` e `src/lib/collector/collect.ts:690`: delete `items` e `attachments`.
- `src/lib/collector/collect.ts:692` a `src/lib/collector/collect.ts:720`: insert filhos.
- `tests/collector-db.test.ts:106` a `tests/collector-db.test.ts:137`: rollback real em Postgres provado.

### Regressões vs `47ae36a`

Resolvidas:

- Volume de refresh de escolas caiu de `41.651` para `851` requests no cenário observado.
- Incremental deixou de parar no primeiro conhecido.
- FK deixou de quebrar para escola sem município.
- Upsert ficou transacional.
- HTTP client ganhou teste real com `fetch` mockado.

Regressões / riscos novos:

- `regional` da escola agora fica `null` sempre no refresh por county. Dado real não permite mapear regional por esse endpoint sem nova estratégia; risco aceito se cidade for prioridade.
- Teste DB faz `drop schema if exists public cascade`; seguro só se `TEST_DATABASE_URL` apontar para `lpa_leo_test`. Código não protege contra URL errada.
- `refreshStale` sem teste Postgres de TTL/cutoff. Código parece correto, mas prova automatizada ainda fraca.

### Comandos da re-review

```bash
git status --short --branch
git log --oneline --decorate -8
git diff --stat 47ae36a..HEAD
nl -ba src/lib/collector/collect.ts
nl -ba src/lib/collector/client.ts
nl -ba src/lib/db/schema.ts
nl -ba drizzle/0002_ordinary_proemial_gods.sql
nl -ba tests/collector.test.ts
nl -ba tests/collector-db.test.ts
nl -ba tests/client.test.ts
node byte-compare contrato canônico
node smoke filters base + county=2725
TEST_DATABASE_URL='postgres://lpa:lpa@localhost:5432/lpa_leo_test' corepack pnpm test tests/collector-db.test.ts -- --run
TEST_DATABASE_URL='postgres://lpa:lpa@localhost:5432/lpa_leo_test' corepack pnpm test -- --run
TEST_DATABASE_URL='postgres://lpa:lpa@localhost:5432/lpa_leo_test' corepack pnpm test tests/collector.test.ts -t 'incremental|refreshStale|schools' -- --run
TEST_DATABASE_URL='postgres://lpa:lpa@localhost:5432/lpa_leo_test' corepack pnpm test tests/client.test.ts -- --run
corepack pnpm typecheck
corepack pnpm lint
rg -n "\.(skip|todo|only)\(" tests || true
node pg query counts/columns/indexes
```

Resultados:

- Branch: `feature/collector`.
- HEAD: `3cdf2d1`.
- Contrato: byte a byte ainda igual, `actualBytes=1315`, `canonicalBytes=1315`.
- Suíte completa: `4 passed (4)`, `14 passed (14)`, exit 0.
- DB isolado: `1 passed (1)`, `2 passed (2)`, exit 0.
- Client isolado: `1 passed (1)`, `4 passed (4)`, exit 0.
- Filtered collector: `3 passed | 4 skipped` por filtro `-t`; suíte completa não tem skip.
- `typecheck`: exit 0.
- `lint`: exit 0.
- Smoke API: 2 requests reais, HTTP 200, sem 429.

## Re-review 2 2026-08-12

### Veredito

`feature/collector` está LIBERADA PRA MERGE.

Os 3 pontos deixados em aberto na re-review anterior foram fechados com prova suficiente: regional volta por varredura regional, `refreshStale` tem prova Postgres de cutoff e re-coleta, testes DB rodam determinísticos duas vezes seguidas.

### 1. `regional` recuperado: RESOLVIDO

Evidência de código:

- `src/lib/collector/collect.ts:337` a `src/lib/collector/collect.ts:340`: lê `regionals` do filtro base.
- `src/lib/collector/collect.ts:342` a `src/lib/collector/collect.ts:350`: varredura por county continua simples, sem ramo antigo `county + regional`.
- `src/lib/collector/collect.ts:353` a `src/lib/collector/collect.ts:360`: passada extra por `regional={idNetwork}` atualiza regional por `idSchool`.
- `src/lib/collector/collect.ts:590` a `src/lib/collector/collect.ts:599`: `updateSchoolRegional` só atualiza escola já existente; escola fora da dimensão não cria linha nova.
- `tests/collector.test.ts:186` a `tests/collector.test.ts:230`: prova `base`, `county:1`, `county:2`, `regional:10`, `regional:20`; escola 100 ganha `SRE/A`; escola 999 de regional sem county não entra.

Smoke real, 3 requests no total, sem 429:

```json
{
  "base": {
    "status": 200,
    "limit": "60",
    "remaining": "58",
    "regionals": 48,
    "counties": 850,
    "schools": 3400
  },
  "county2725": {
    "status": 200,
    "remaining": "57",
    "schools": 1,
    "captures10888": true,
    "school10888": {
      "idSchool": 10888,
      "txName": "EE PEDRO ALVARES CABRAL"
    }
  },
  "regional195": {
    "status": 200,
    "remaining": "55",
    "schools": 26,
    "captures10888": true,
    "school10888": {
      "idSchool": 10888,
      "txName": "EE PEDRO ALVARES CABRAL"
    }
  },
  "idSchoolJoinWorks": true
}
```

Conclusão:

- `EE PEDRO ALVARES CABRAL` (`idSchool 10888`, `county 2725`) continua entrando pela varredura por county.
- `regional=195` (`SRE/MONTE CARMELO`) devolve a mesma escola.
- Casamento por `idSchool` funciona.
- Ramo quebrado `county + regional` não voltou.

Volume de requests:

- Antes bugado em `47ae36a`: `1 + 850 + 850 * 48 = 41.651`.
- Em `3cdf2d1`: `1 + 850 = 851`.
- Agora em `4ff8827`: `1 + 850 + 48 = 899`.
- Continua casa de 900, não voltou para dezenas de milhares.

Observação não bloqueante:

- `updateSchoolRegional` sobrescreve `schools.raw_json` com `{ school, regional }`, perdendo raw JSON de county nessa dimensão. Cidade/idCounty seguem em colunas; oportunidade `raw_json` intacto.

### 2. `refreshStale` em Postgres: RESOLVIDO

Evidência de código:

- `src/lib/collector/collect.ts:278` a `src/lib/collector/collect.ts:283`: `cutoff = Date.now() - olderThanDays * 24h`, default 7 dias.
- `src/lib/collector/collect.ts:285` a `src/lib/collector/collect.ts:296`: cada stale record chama `buildOpportunityRecord`, então re-coleta `detail`, `items`, `attachments`.
- `src/lib/collector/collect.ts:750` a `src/lib/collector/collect.ts:778`: Drizzle usa `lt(opportunities.collectedAt, cutoff)`. Limite exato fica fora.

Evidência de teste Postgres:

- `tests/collector-db.test.ts:147` a `tests/collector-db.test.ts:164`: borda exata testada.
- Caso testado:
  - `cutoff - 1ms`: entra.
  - `cutoff`: fica fora.
  - `cutoff + 1ms`: fica fora.
- `tests/collector-db.test.ts:166` a `tests/collector-db.test.ts:209`: `refreshStale` com TTL 7 dias:
  - registro de 8 dias entra.
  - registro de 6 dias fica fora.
  - `client.detailCalls` contém só registro vencido.
  - `purchaseOrderStatus` do vencido muda para `APRO`.
  - registro fresco continua `ENVD`.
  - filhos mudam para 1 item e 1 anexo, provando re-coleta de `items` e `attachments`, não só data.

Conclusão:

- Registro exatamente no limite não entra porque query usa `< cutoff`, não `<=`.
- Registro dentro do TTL fica de fora.
- Refresh atualiza linha e filhos.

### 3. Determinismo dos testes de banco: RESOLVIDO

Evidência de código:

- `vitest.config.ts:10` a `vitest.config.ts:13`: `fileParallelism: false`.
- `tests/collector-db.test.ts:57`: lock key fixo `941445001`.
- `tests/collector-db.test.ts:63` a `tests/collector-db.test.ts:72`: conecta em Postgres real, `select 1`, depois `pg_advisory_lock`.
- `tests/collector-db.test.ts:79` a `tests/collector-db.test.ts:82`: `afterAll` chama `pg_advisory_unlock` e `pool.end`.

Execuções seguidas, sem limpeza manual de banco:

```bash
TEST_DATABASE_URL='postgres://lpa:lpa@localhost:5432/lpa_leo_test' corepack pnpm test -- --run
```

Resultado 1:

- `Test Files 4 passed (4)`
- `Tests 16 passed (16)`
- exit 0

Resultado 2:

- `Test Files 4 passed (4)`
- `Tests 16 passed (16)`
- exit 0

Skip escondido:

- `rg -n "\.(skip|todo|only)\(" tests || true`: sem saída.
- Resumo das duas suítes não mostra skip.

Lock:

```json
{"lockKey":941445001,"acquiredAfterTests":true}
```

Interpretação:

- Depois de duas suítes, nova sessão conseguiu `pg_try_advisory_lock(941445001)`.
- Lock não ficou preso.
- Em falha comum de assertion, Vitest roda `afterAll`; mesmo se unlock rodar em conexão diferente do pool, `pool.end()` fecha a sessão que segura o lock e libera o advisory lock.
- Falha por kill -9 nunca tem garantia em nenhum runner, mas Postgres libera lock ao fechar sessão do processo morto.

### 4. Regressão vs `3cdf2d1`: RESOLVIDO

Arquivos alterados desde `3cdf2d1`:

- `src/lib/collector/collect.ts`
- `tests/collector-db.test.ts`
- `tests/collector.test.ts`
- `vitest.config.ts`

Sem regressão nos pontos homologados:

- Contrato `src/lib/contracts/opportunity.ts`: byte a byte igual à especificação, `actualBytes=1315`, `canonicalBytes=1315`.
- Suíte completa: 16 testes verdes duas vezes.
- `typecheck`: exit 0.
- `lint`: exit 0.
- Smoke real: county ainda captura `idSchool 10888`.
- Refresh de escolas: 899 requests estimados, não 41.651.
- DB real: idempotência, FK/stub, rollback, cutoff e refresh stale cobertos.

### Comandos da re-review 2

```bash
git status --short --branch
git log --oneline --decorate -8
git diff --stat 3cdf2d1..HEAD
git diff --name-only 3cdf2d1..HEAD
nl -ba src/lib/collector/collect.ts
nl -ba tests/collector-db.test.ts
nl -ba tests/collector.test.ts
nl -ba vitest.config.ts
node smoke filters base
node smoke filters county=2725 + regional=195
TEST_DATABASE_URL='postgres://lpa:lpa@localhost:5432/lpa_leo_test' corepack pnpm test -- --run
TEST_DATABASE_URL='postgres://lpa:lpa@localhost:5432/lpa_leo_test' corepack pnpm test -- --run
rg -n "\.(skip|todo|only)\(" tests || true
corepack pnpm typecheck
corepack pnpm lint
node pg_try_advisory_lock check
node byte-compare contrato canônico
```

Resultados:

- Branch: `feature/collector`.
- HEAD: `4ff88271c47d2c79ccd5ecdea61bf35c7936985b`.
- Live API: 3 requests reais, todos HTTP 200, sem 429.
- Suíte 1: `4 passed (4)`, `16 passed (16)`, exit 0.
- Suíte 2: `4 passed (4)`, `16 passed (16)`, exit 0.
- `typecheck`: exit 0.
- `lint`: exit 0.
- Lock livre após testes: `acquiredAfterTests: true`.
- Worktree alvo sem alteração rastreada; só `?? .codex/` preexistente.
