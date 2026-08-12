# Dashboard Review - feature/dashboard @ 80f2405

STATUS: NAO LIBERADA PARA MERGE

## Evidencia curta

- Branch: `feature/dashboard`
- Commit: `80f2405370b5f3e97fcecacd27bb08948c0cf92a`
- Worktree: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard`
- Contrato: `src/lib/contracts/opportunity.ts` igual byte a byte ao canonico.
- Contrato bytes: local `1315`, canonico `1315`, `equal=true`.
- Dev server usado: `corepack pnpm dev`, URL `http://localhost:3000`.
- Screenshots:
  - `/Users/haza/Desktop/Projetos/LPA_Leo/research/review/shots/desktop-list.png`
  - `/Users/haza/Desktop/Projetos/LPA_Leo/research/review/shots/desktop-detail.png`
  - `/Users/haza/Desktop/Projetos/LPA_Leo/research/review/shots/mobile-list.png`
  - `/Users/haza/Desktop/Projetos/LPA_Leo/research/review/shots/mobile-detail.png`
  - `/Users/haza/Desktop/Projetos/LPA_Leo/research/review/shots/filter-city-category.png`
  - `/Users/haza/Desktop/Projetos/LPA_Leo/research/review/shots/filter-city-category-query.png`
  - `/Users/haza/Desktop/Projetos/LPA_Leo/research/review/shots/filter-pagination-page2.png`
  - `/Users/haza/Desktop/Projetos/LPA_Leo/research/review/shots/zero-state.png`
  - `/Users/haza/Desktop/Projetos/LPA_Leo/research/review/shots/not-found.png`

## BLOQUEIA MERGE

### 1. Mocks nao sao "40 oportunidades reais-normalizadas"; muitos campos comerciais foram fabricados

- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/lib/data/source.ts:113`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/lib/data/source.ts:186`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/lib/data/source.ts:298`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/lib/data/source.ts:303`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/lib/data/source.ts:304`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/lib/data/source.ts:307`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/lib/data/source.ts:314`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/lib/data/source.ts:342`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/lib/data/source.ts:344`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/lib/data/source.ts:350`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/lib/data/source.ts:351`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/lib/data/source.ts:450`

O que esta errado:

- Os 40 `orderRows` batem com `pagesize_1000.json` para campos de lista: `orderId`, `year`, `school`, `subprogram`, `expenseGroup`, `purchaseDate`, `idSubprogram`, `idSchool`, `idBudget`, `idSupplier`.
- `supplierName` vem de `filters_base.json.suppliers` para 37/40; 3 diferem por trim de espaco final: `2027075582`, `2027075562`, `2027075561`.
- So existem fixtures de detalhe/itens para 3 pedidos: `detail_1.json/items_1.json`, `detail_2.json/items_2.json`, `detail_3.json/items_3.json`.
- Para os outros 37 pedidos, `supplierDocument`, `deliveryDate`, `proposalDate` e `items` nao derivam dos payloads lidos.
- `summary`, `headline`, `topItems`, `totalValue`, `attachments` e `category.confidence` sao gerados por template para todos os 40.
- `city` e `regional` sao atribuidos por linha no seed, mas os fixtures de pedido nao trazem municipio/regional por escola. `filters_base.json` tem listas soltas de municipios/regionais, sem vinculo escola->cidade/regional.
- `rawJson` nao preserva o payload real completo; guarda um objeto parcial fabricado com `fixture: "pagesize_1000.json"` e subset de `order`.

Caso concreto que quebra:

- Pedido `2027075586`: fixture real `items_3.json` tem itens como `Amido de milho`, `Acafrao po`, `Acucar cristal`, `Alho`, `Amendoim`, `Arroz`; o dashboard mostra `Carnes e frios` com `carne bovina`, `frango`, `linguica`.
- Pedido `2027075587`: fixture real `items_2.json` tem 1 item de telha, quantidade `100`; o dashboard cria 4 itens, altera quantidade da telha para `103` por `index % 4`, e soma total artificial.
- Pedido `2027075584`: dashboard mostra `supplierDocument: 41.253.000/0001-00`, `deliveryDate: 2026-09-12T12:00:00.000Z`, `proposalDate: 2026-08-02T12:00:00.000Z`; nao ha detalhe desse pedido nos fixtures.

Impacto:

- Produto visual depende de o fornecedor confiar no card sem abrir processo. Dado inventado com cara de real passa confianca falsa.

### 2. Troca mock -> banco nao esta isolada em 1 arquivo

- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/app/page.tsx:3`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/app/page.tsx:49`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/app/page.tsx:243`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/app/opportunity/[externalId]/page.tsx:136`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/app/not-found.tsx:12`

O que esta errado:

- `page.tsx` importa `mockOpportunities` direto junto com `opportunitySource`.
- A metrica `registros` usa `mockOpportunities.length`.
- `getCategoryOptions()` percorre `mockOpportunities`, nao `result.facets` nem `opportunitySource`.
- UI mostra texto de mock em producao: `Nenhum anexo no mock.` e `seed mockado`.

Caso concreto que quebra:

- Se `src/lib/data/source.ts` trocar para banco e nao exportar `mockOpportunities`, a home quebra no import.
- Se o banco tiver 10.000 registros e a pagina lista 12, a metrica `registros` continua presa ao array mockado se ele permanecer como compatibilidade.

### 3. Detalhe mobile tem scroll horizontal real em viewport 375px

- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/app/opportunity/[externalId]/page.tsx:47`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/app/opportunity/[externalId]/page.tsx:48`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/app/opportunity/[externalId]/page.tsx:112`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/app/opportunity/[externalId]/page.tsx:178`

O que esta errado:

- Em viewport mobile `375x812`, a pagina de detalhe tem `documentElement.scrollWidth=450`, `bodyWidth=450`, `viewportWidth=375`.
- Screenshot: `/Users/haza/Desktop/Projetos/LPA_Leo/research/review/shots/mobile-detail.png`
- O container principal do detalhe fica com filhos de `434px` a partir de `left=16/right=450`.

Caso concreto que quebra:

- URL testada: `http://localhost:3000/opportunity/2027075592`
- Fornecedor em celular recebe a pagina mais larga que a viewport. O botao final e os paineis extrapolam a largura logica da pagina.

## CORRIGIR ANTES DE PRODUCAO

### 4. Filtro de categoria tem label enganosa e mistura headlines diferentes

- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/lib/data/source.ts:314`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/lib/data/source.ts:348`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/app/page.tsx:243`

O que esta errado:

- `category.slug` fica `alimentos` para varios cards, mas `category.name` vira headline comercial variavel: `Paes e panificacao`, `Carnes e frios`, `Frutas e Verduras`, `Mercearia escolar`.
- `getCategoryOptions()` usa `Map` por slug; o ultimo nome visto para `alimentos` vira label do select.
- No navegador, option `value=alimentos` apareceu com label `Mercearia escolar`.

Caso concreto que quebra:

- Filtro aplicado via UI: categoria `Mercearia escolar`.
- Resultado: 23 cards, incluindo `Paes e panificacao`, `Carnes e frios`, `Frutas e Verduras` e `Mercearia escolar`.
- Screenshot: `/Users/haza/Desktop/Projetos/LPA_Leo/research/review/shots/filter-pagination-page2.png`

### 5. Campos nulos principais nao explodem, mas `topItems` vazio vira area em branco

- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/components/opportunity-card.tsx:35`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/components/opportunity-card.tsx:39`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/components/opportunity-card.tsx:43`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/components/opportunity-card.tsx:55`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/app/opportunity/[externalId]/page.tsx:63`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/app/opportunity/[externalId]/page.tsx:99`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/app/opportunity/[externalId]/page.tsx:102`

O que esta certo:

- `city: null` renderiza `Nao informado`.
- `supplierName: null` renderiza `Nao informado`.
- `deliveryDate: null`, `purchaseDate: null`, `proposalDate: null` renderizam `Nao informado`.
- `unitValue: null` e `totalValue: null` em item renderizam `Valor nao informado`.
- `attachments: []` nao quebra detalhe.

O que esta errado:

- `topItems: []` renderiza o titulo `Principais itens:` seguido de paragrafo vazio no card e no detalhe.
- `attachments: []` renderiza texto com palavra de mock: `Nenhum anexo no mock.`

Caso concreto que quebra:

- Collector real pode produzir `topItems: []`. O fornecedor ve um bloco importante vazio, sem fallback como `Itens nao informados`.

### 6. Helpers deixam `R$ NaN` e data invalida pode derrubar render

- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/components/opportunity-card.tsx:69`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/components/opportunity-card.tsx:78`

O que esta errado:

- `formatCurrency(Number.NaN)` retorna `R$ NaN`; so existe guarda para `null`.
- `formatDate("not-a-date")` lanca `Invalid time value`; so existe guarda para valor vazio.

Caso concreto que quebra:

- Se parsing do collector gerar `NaN` em vez de `null` para valor, o card mostra `R$ NaN`.
- Se data vier string invalida, a renderizacao cai no boundary de erro.

### 7. Estado de erro existe, mas nao ha caminho de UI/dados atual para provar em browser sem adulterar fonte

- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/app/error.tsx:3`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/app/error.tsx:18`

O que esta errado:

- `error.tsx` existe, mas o fluxo atual usa seed local sem chamada remota e sem caminho de erro acionavel pela UI.
- O texto renderiza `error.message`, o que pode vazar erro tecnico para usuario final quando o banco/API falhar.

Estados provados:

- Loading: apareceu em navegacao client-side para detalhe; apos URL `/opportunity/2027075592`, `pulseCount=7` antes do conteudo final.
- Vazio: provado por UI com cidade `Montes Claros` + categoria `Seguranca eletronica`; `0 resultado`, screenshot `zero-state.png`.
- Not found: provado por URL `/opportunity/nao-existe`, screenshot `not-found.png`.
- Erro: arquivo existe, mas nao foi alcancado por UI real sem alterar/injetar falha na fonte.

### 8. Card cumpre campos minimos, mas carrega ruido que reduz leitura rapida

- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/components/opportunity-card.tsx:10`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/components/opportunity-card.tsx:13`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/components/opportunity-card.tsx:20`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/components/opportunity-card.tsx:28`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/components/opportunity-card.tsx:47`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/components/opportunity-card.tsx:52`
- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/components/opportunity-card.tsx:59`

O que bate com formato esperado:

- Headline/categoria no topo.
- Escola.
- Cidade.
- Entrega.
- `O que precisam:`.
- `Principais itens:`.
- Botao `Ver oportunidade`.

O que nao bate:

- O card adiciona valor total, contagem de itens, grupo de despesa e fornecedor.
- Visualmente a categoria/headline e itens aparecem com peso bom, mas o topo disputa atencao com valor total em verde.
- O problema maior nao e hierarquia: e que varios headlines/itens/resumos sao fabricados.

Caso concreto:

- Primeiro card desktop: `Paes e panificacao`, escola, cidade, entrega, resumo, item e botao estao legiveis.
- Screenshot: `/Users/haza/Desktop/Projetos/LPA_Leo/research/review/shots/desktop-list.png`

## MELHORIA

### 9. Form inclui parametros vazios na URL apos filtrar

- Arquivo: `/Users/haza/Desktop/Projetos/LPA_Leo/.worktrees/dashboard/src/app/page.tsx:61`

O que esta errado:

- Submit gera URLs como `/?query=&city=Montes+Claros&category=alimentos&expenseGroup=&school=&periodStart=&periodEnd=`.
- A paginacao depois limpa os vazios porque `currentParams` ignora valores vazios na leitura.

Caso concreto:

- Filtro cidade+categoria gerou URL com seis parametros vazios.
- Nao quebra resultado, mas deixa estado compartilhavel mais ruidoso.

## Filtros testados no navegador

- Cidade + categoria: `Montes Claros` + `alimentos`.
  - URL: `/?query=&city=Montes+Claros&category=alimentos&expenseGroup=&school=&periodStart=&periodEnd=`
  - Resultado: 3 cards.
  - Cards: `Paes e panificacao`, `Carnes e frios`, `Carnes e frios`.
  - Screenshot: `filter-city-category.png`
- Cidade + categoria + busca textual: `Montes Claros` + `alimentos` + `frango`.
  - URL: `/?query=frango&city=Montes+Claros&category=alimentos&expenseGroup=&school=&periodStart=&periodEnd=`
  - Resultado: 2 cards.
  - Cards: `Carnes e frios`, `Carnes e frios`.
  - Screenshot: `filter-city-category-query.png`
- Zero: `Montes Claros` + `seguranca`.
  - URL: `/?query=&city=Montes+Claros&category=seguranca&expenseGroup=&school=&periodStart=&periodEnd=`
  - Resultado: 0 cards.
  - Estado vazio renderizado.
  - Screenshot: `zero-state.png`
- Filtro + paginacao: categoria `alimentos`, pagina 2.
  - Pagina 1: 23 resultados, `1/2`.
  - Clique em `Proxima`.
  - URL: `/?category=alimentos&page=2`
  - Resultado: 11 cards, `2/2`.
  - Filtro preservado.
  - Screenshot: `filter-pagination-page2.png`

## Testes executados

- `node` compare byte a byte do contrato: exit `0`, `actualBytes=1315`, `canonicalBytes=1315`, `equal=true`.
- `corepack pnpm dev`: exit `0` apos `Ctrl-C`, servidor navegavel em `http://localhost:3000`.
- Playwright real via Chromium headless:
  - Desktop listagem.
  - Desktop detalhe.
  - Mobile listagem `375x812`.
  - Mobile detalhe `375x812`.
  - Filtros combinados.
  - Vazio.
  - Not found.
- `corepack pnpm lint`: exit `0`.
- `corepack pnpm typecheck`: exit `0`.
- `corepack pnpm test`: exit `0`, `1 passed (1)`.
- `corepack pnpm build`: exit `0`.

## Veredito

`feature/dashboard` nao esta liberada para merge.

Bloqueadores:

- Mocks com muitos campos fabricados e nao derivados dos fixtures.
- Troca mock -> banco nao isolada em 1 arquivo.
- Detalhe mobile com scroll horizontal real.

## Re-review 2026-08-12

STATUS: NAO LIBERADA AUTOMATICAMENTE PARA MERGE

Commit reavaliado: `ebe757c00bc54c33b69364fece558cb374479d05`.

### 1. Dado fabricado morreu MESMO? RESOLVIDO

Evidencia:

- `opportunitySource.listOpportunities({}, { page: 1, pageSize: 48 })` retornou 40 registros.
- Comparacao campo a campo contra `pagesize_1000.json` + `detail_1..3.json` + `items_1..3.json`: `mismatchesCount=0`.
- Para os 37 registros sem fixture de detalhe: `supplierDocument=null`, `supplierName=null`, `deliveryDate=null`, `proposalDate=null`, `purchaseOrderStatus=null`, `initiativeDescription=null`, `items=[]`, `topItems=[]`, `attachments=[]`, `totalValue=null`, `category=null`, `city=null`, `regional=null`.
- `cityNonNull=[]`; `regionalNonNull=[]`.
- `rawJson` dos 40 registros bate com o objeto inteiro real da listagem em `pagesize_1000.json`.
- `2027075586` corrigido: itens agora saem de `items_3.json` (`Amido de milho`, `Açafrão pó`, `Açúcar cristal`, `Alho`, `Amendoim`...), `itemCount=36`, `totalValue=null` porque a fixture tem pagina parcial.
- `2027075587` corrigido: 1 item real de telha, `totalValue=695`, sem os 4 itens artificiais anteriores.

Nota:

- Para 3 registros com detalhe, `category` ainda e normalizacao derivada de `expenseGroup` (`alimentos`, `manutencao`) com `confidence=1`; nao vem literal do portal. Nao sobrou item, valor, cidade, regional, fornecedor ou data inventada nos 37 sem detalhe.
- `summary` nos 37 sem detalhe vira fallback explicito `Resumo não informado.`, nao resumo comercial falso.

### 2. Isolamento mock -> banco. RESOLVIDO

Evidencia:

- `rg -n "mock|seed|mockOpportunities|fixture|fixtures|opportunitySource|@/lib/data/source" src`
- UI importa so `opportunitySource`:
  - `src/app/page.tsx:3`
  - `src/app/opportunity/[externalId]/page.tsx:4`
- Nenhuma pagina/componente importa `mockOpportunities`, `listingOrders`, fixture ou seed direto.
- Contagem vem da fonte: `src/app/page.tsx:47` usa `result.totalAvailable`.
- Facets vem da fonte:
  - cidade: `src/app/page.tsx:73`
  - categoria: `src/app/page.tsx:80`
  - grupo: `src/app/page.tsx:90`
  - escola: `src/app/page.tsx:97`
- Strings `mock`/`seed` nao aparecem na UI. `not-found.tsx` agora diz `fonte de dados`.

Conclusao:

- Trocar so `src/lib/data/source.ts` por banco deve bastar para a UI atual, desde que o banco implemente o mesmo contrato de `opportunitySource`.

### 3. Scroll mobile 375x812. RESOLVIDO PARA SCROLL DA PAGINA / PARCIAL PARA TABELA INTERNA

Screenshots:

- `/Users/haza/Desktop/Projetos/LPA_Leo/research/review/shots/rereview-mobile-list.png`
- `/Users/haza/Desktop/Projetos/LPA_Leo/research/review/shots/rereview-mobile-detail-null-2027075584.png`
- `/Users/haza/Desktop/Projetos/LPA_Leo/research/review/shots/rereview-mobile-detail-manyitems-2027075586.png`
- `/Users/haza/Desktop/Projetos/LPA_Leo/research/review/shots/rereview-mobile-worstcase-forced-dom.png`

Medidas Playwright:

- Listagem mobile: `docScrollWidth=375`, `bodyScrollWidth=375`, `clientWidth=375`, `hasPageHorizontalScroll=false`.
- Detalhe sem dados `2027075584`: `docScrollWidth=375`, `bodyScrollWidth=375`, `clientWidth=375`, `hasPageHorizontalScroll=false`.
- Detalhe muitos itens reais `2027075586`: `docScrollWidth=375`, `bodyScrollWidth=375`, `clientWidth=375`, `hasPageHorizontalScroll=false`.
- Pior caso forçado no browser, sem alterar produção: H1 muito longo sem espaço, descrição longa, 26 linhas clonadas na tabela: `docScrollWidth=375`, `bodyScrollWidth=375`, `clientWidth=375`, `hasPageHorizontalScroll=false`.

Nota:

- A tabela de itens ainda tem scroll horizontal interno: wrapper `clientWidth=309`, `scrollWidth=903`. Isso nao cria scroll horizontal da pagina, mas exige rolagem interna para ver colunas de valor.

### 4. Regressao filtros com dado nulo. PARCIAL

Evidencia:

- Seed honesto deixa `facets.cities=[]`.
- Select de cidade no navegador tem so `Todos`.
- Filtrar por cidade via URL `/?city=Montes+Claros`: `articleCount=0`, estado vazio.
- Combinar cidade + categoria + busca via URL `/?city=Montes+Claros&category=alimentos&query=pão`: `articleCount=0`, estado vazio.
- Categoria funciona, mas so nos 3 registros com detalhe:
  - `/?category=alimentos`: `articleCount=2`.
  - `/?category=manutencao`: `articleCount=1`.
  - `/?category=alimentos&query=pão`: `articleCount=1`.
- Unfiltered pagination ainda funciona:
  - `/?page=2`: `articleCount=12`, `Página 2 de 4`.
  - `/?page=4`: `articleCount=4`, `Página 4 de 4`.
- Caso ruim: `/?category=alimentos&page=2` renderiza vazio, embora `category=alimentos` tenha 2 resultados. Causa provavel: `listOpportunities` calcula `offset` com `pageNumber` original antes de clamp para `totalPages`.

Conclusao:

- Filtros continuam parcialmente funcionais com seed honesto.
- Cidade nao e funcional neste seed.
- Categoria/busca funcionam apenas para registros detalhados.
- Combo cidade+categoria+busca vira vazio permanente se `city` for passado.
- Isso pode ser aceitavel como consequencia do seed honesto, mas precisa decisao explicita antes do merge. Se a meta e demonstrar filtros agora, nao esta pronto.

Screenshots:

- `/Users/haza/Desktop/Projetos/LPA_Leo/research/review/shots/rereview-filter-category-alimentos.png`
- `/Users/haza/Desktop/Projetos/LPA_Leo/research/review/shots/rereview-filter-city-manual-zero.png`
- `/Users/haza/Desktop/Projetos/LPA_Leo/research/review/shots/rereview-filter-city-category-query-zero.png`

### 5. Estados com dado nulo. RESOLVIDO

Evidencia visual:

- Card sem detalhe na listagem mostra:
  - `Cidade: Não informado`
  - `Entrega: Não informado`
  - `Fornecedor: Não informado`
  - `Resumo não informado.`
  - `Principais itens: Itens não informados`
  - `Valor não informado`
- Detalhe sem itens `2027075584` mostra:
  - `Itens não informados.`
  - `Nenhum anexo informado.`
  - fornecedor/documento/status como `Não informado`
- Busca textual no DOM: sem `null`, sem `undefined`, sem `NaN`, sem `mock`, sem `seed`.

Screenshot:

- `/Users/haza/Desktop/Projetos/LPA_Leo/research/review/shots/rereview-mobile-detail-null-2027075584.png`

### Testes executados no re-review

- `git rev-parse HEAD`: exit `0`, `ebe757c00bc54c33b69364fece558cb374479d05`.
- `rg -n "mock|seed|mockOpportunities|fixture|fixtures|opportunitySource|@/lib/data/source" src`: exit `0`.
- Script `tsx` comparando 40 registros contra fixtures: exit `0`, `mismatchesCount=0`, `leftoversCount=0`.
- `corepack pnpm dev`: servidor abriu em `http://localhost:3000`, encerrado com `Ctrl-C`.
- Playwright Chromium headless em `375x812`: exit `0`, screenshots salvos.
- `corepack pnpm lint`: exit `0`.
- `corepack pnpm typecheck`: exit `0`.
- `corepack pnpm test`: exit `0`, `1 passed (1)`.
- `corepack pnpm build`: exit `0`.

### Veredito do re-review

Originais 3 bloqueadores:

- Dado fabricado: resolvido.
- Mock -> banco: resolvido.
- Scroll horizontal da pagina mobile: resolvido.

Novo ponto antes de merge:

- Filtros com seed honesto ficaram parciais: cidade sem opcoes, combo com cidade sempre vazio, categoria so cobre 3 registros.
- Bug de pagina stale: `?category=alimentos&page=2` mostra vazio apesar de haver 2 resultados.

Recomendacao:

- Nao liberar merge sem decisao explicita sobre essa limitacao de filtros.
- Se a decisao for aceitar seed honesto com filtros parciais ate o banco real, merge fica tecnicamente defensavel.
- Se a branch precisa demonstrar filtros cidade+categoria agora, falta corrigir/ajustar UI ou seed.
