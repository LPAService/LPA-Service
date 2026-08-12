# Recon técnico - Caixa Escolar MG

Data: 2026-08-12

## Descoberta

O portal principal `https://caixaescolar.educacao.mg.gov.br/` é uma Angular SPA do SGD autenticado. O bundle aponta API interna `https://api.caixaescolar.educacao.mg.gov.br` e rotas de compras sob `/compras`, mas protegidas por `canActivate`.

O mesmo bundle referencia `transparencia.caixaescolar.educacao.mg.gov.br`. Esse é o frontend público correto para obter programaticamente ordens/processos publicados. O bundle público contém `api.baseUrl = https://transparencia-api.caixaescolar.educacao.mg.gov.br`.

## Endpoints públicos

| Método | URL | Headers necessários | Auth | Params | Resposta | Paginação/filtros | Rate limit observado |
|---|---|---|---|---|---|---|---|
| GET | `https://transparencia-api.caixaescolar.educacao.mg.gov.br/public/purchase-orders` | nenhum especial. Browser usa Origin `https://transparencia.caixaescolar.educacao.mg.gov.br`; curl sem auth funcionou. | não | `portalSlug=mg`, `page`, `pageSize`, `year`, `idSchool`, `idSubprogramRoot`, `expenseGroup`, `accountabilityStatus`, `accountabilitySent`, `regional`, `county`, `idSupplier`, `company`, `schoolInep`, `sortBy`, `sortDir` | `{ data: [...], meta: { page, pageSize, total, totalPages } }` | `page` 1-based; `pageSize` validado com 5 e 10; total visto: 139678; `sortBy=dtPurchaseOrder&sortDir=DESC` funcionou | headers: `x-ratelimit-limit: 200`, `x-ratelimit-remaining`, `x-ratelimit-reset: 1` |
| GET | `https://transparencia-api.caixaescolar.educacao.mg.gov.br/public/purchase-orders/by-subprogram/{idSubprogram}/by-school/{idSchool}/by-budget/{idBudget}/detail` | nenhum especial | não | `portalSlug=mg` | objeto de detalhe: ano, id/ordem, status, datas, subprograma, iniciativa, grupo, fornecedor | sem paginação | `x-ratelimit-limit: 200` |
| GET | `https://transparencia-api.caixaescolar.educacao.mg.gov.br/public/purchase-orders/by-subprogram/{idSubprogram}/by-school/{idSchool}/by-budget/{idBudget}/items` | nenhum especial | não | `portalSlug=mg`, `idSupplier`, `page`, `pageSize`, `sortBy=budgetItem.nuItemOrder:ASC` | `{ data: [...], meta: { page, pageSize, total, totalPages } }` | `page/pageSize`; ordenação por `sortBy` no formato `campo:ASC|DESC` | `x-ratelimit-limit: 200` |
| GET | `https://transparencia-api.caixaescolar.educacao.mg.gov.br/public/purchase-orders/by-subprogram/{idSubprogram}/by-school/{idSchool}/by-budget/{idBudget}/images` | nenhum especial | não | `portalSlug=mg` | array de anexos/imagens: `{ id, filename, url, thumbUrl }` | sem paginação validada. `limit` aparece no bundle, mas backend respondeu 400: `property limit should not exist` | `x-ratelimit-limit: 200` |
| GET | `https://transparencia-api.caixaescolar.educacao.mg.gov.br/public/portal/filters` | nenhum especial | não | `portalSlug=mg`, `regional`, `year`, `subprogram`, `county`, `school` | objeto com `regionals`, `years`, `subprograms`, `expenseGroups`, `counties`, `schools`, `statuses`, `suppliers` | filtros responsivos; `year=2026` validado | `x-ratelimit-limit: 60` |
| GET | `https://transparencia-api.caixaescolar.educacao.mg.gov.br/public/indicators/summary` | nenhum especial | não | `idSubprogramHeritage`, `txYear`, `idSchool`, `idCounty`, `idNetwork`, `portalSlug`, `txExpenseGroup`, `idSupplier`, `accountabilityStatus`, `schoolInep` | resumo de indicadores | não é listagem de processos | não medido |
| GET | `https://transparencia-api.caixaescolar.educacao.mg.gov.br/public/indicators/bars` | nenhum especial | não | mesmos params de summary | séries agregadas | não é listagem de processos | não medido |
| GET | `https://transparencia-api.caixaescolar.educacao.mg.gov.br/public/networks/portal-info` | nenhum especial | não | `slug` | metadata do portal | sem paginação | não medido |

## Paginação

Listagem:

- `page`: 1-based.
- `pageSize`: validado com `5` e `10`.
- `meta.total`: total de registros.
- `meta.totalPages`: total de páginas.

Itens:

- `page`: 1-based.
- `pageSize`: validado com `10`.
- `sortBy`: backend aceitou `budgetItem.nuItemOrder:ASC`.

## Filtros

Filtros observados no bundle da listagem pública:

- `year`
- `idSchool`
- `idSubprogramRoot`
- `expenseGroup`
- `accountabilityStatus`
- `accountabilitySent`
- `regional`
- `county`
- `idSupplier`
- `company`
- `schoolInep`
- `portalSlug`
- `sortBy`
- `sortDir`

Endpoint `/public/portal/filters?portalSlug=mg` retorna opções para:

- regionais: `{ idNetwork, txName }`
- anos: `{ year }`
- subprogramas
- grupos de despesa: `{ idExpenseGroup, txExpenseGroup }`
- municípios: `{ idCounty, txCounty }`
- escolas: `{ idSchool, txName }`
- status: `AGUA`, `APRO`, `DILI`, `ENVD`, `REPR`
- fornecedores: `{ idSupplier, txName }`

Não encontrei filtro explícito de valor. Valores aparecem nos itens (`nuValueByItem`, `nuQuantity`) e podem ser agregados client-side.

## Detalhe de processo

Endpoint:

`GET /public/purchase-orders/by-subprogram/{idSubprogram}/by-school/{idSchool}/by-budget/{idBudget}/detail?portalSlug=mg`

As chaves vêm da listagem: `idSubprogram`, `idSchool`, `idBudget`; `idSupplier` é usado para filtrar itens/proposta.

## Documentos/anexos

Endpoint de metadata:

`GET /public/purchase-orders/by-subprogram/{idSubprogram}/by-school/{idSchool}/by-budget/{idBudget}/images?portalSlug=mg`

Payload real encontrado:

```json
{
  "id": 413227,
  "filename": "1170dbf5-a6fc-4a96-ae87-0d2387663471.pdf",
  "url": "",
  "thumbUrl": "/public/files/thumb?key=1170dbf5-a6fc-4a96-ae87-0d2387663471.pdf"
}
```

Download do arquivo não ficou resolvido:

- `https://transparencia-api.caixaescolar.educacao.mg.gov.br/public/files/thumb?key=...` retornou 404 JSON.
- `https://transparencia-api.caixaescolar.educacao.mg.gov.br/public/files/download?key=...` retornou 404 JSON.
- `https://transparencia-api.caixaescolar.educacao.mg.gov.br/public/files?key=...` retornou 404 JSON.
- `https://transparencia.caixaescolar.educacao.mg.gov.br/public/files/thumb?key=...` retornou HTML da SPA.

Conclusão: metadata pública existe; URL pública de download não foi exposta/confirmada nos bundles inspecionados. Não exige auth para metadata.

## Robots.txt e ToS

- `https://caixaescolar.educacao.mg.gov.br/robots.txt` retornou HTML da SPA principal, não diretivas robots.
- `https://transparencia.caixaescolar.educacao.mg.gov.br/robots.txt` retornou HTML da SPA pública, não diretivas robots.
- URLs comuns de termos/política (`/termos-de-uso`, `/politica-de-privacidade`, `/terms`, `/privacy`) retornaram fallback SPA; não encontrei ToS legível por fetch direto.

## Fixtures salvos

- `fixtures/purchase_orders_page1.json`
- `fixtures/purchase_orders_page2.json`
- `fixtures/purchase_orders_year_2026.json`
- `fixtures/purchase_orders_sort_date_desc.json`
- `fixtures/detail_1.json`
- `fixtures/detail_2.json`
- `fixtures/detail_3.json`
- `fixtures/items_1.json`
- `fixtures/items_2.json`
- `fixtures/items_3.json`
- `fixtures/attachments_1.json`
- `fixtures/attachments_2.json`
- `fixtures/attachments_3.json`
- `fixtures/attachment_metadata.json`
- `fixtures/filters_base.json`
- `fixtures/filters_year_2026.json`

