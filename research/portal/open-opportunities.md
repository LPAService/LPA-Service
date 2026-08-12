# Oportunidades abertas - Caixa Escolar MG

Data: 2026-08-12

Veredito final: a API pública serve para OPORTUNIDADES ABERTAS? **NÃO**.

A API pública de transparência serve para compras/ordens já com fornecedor vencedor/adjudicado. Para oportunidade aberta ao fornecedor, o caminho visível sem login é cadastro/login no SGD; a visualização e envio de propostas ficam dentro do menu autenticado `Compras`.

## 1. Existe registro em `/public/purchase-orders` sem fornecedor definido?

Não encontrei registro sem fornecedor definido no que a API pública expõe.

Evidência principal:

URL:

`GET https://transparencia-api.caixaescolar.educacao.mg.gov.br/public/purchase-orders?portalSlug=mg&page=1&pageSize=5`

Amostra:

```json
{
  "orderId": "2027075592",
  "accountabilityStatus": "NENV",
  "accountabilitySent": false,
  "purchaseDate": "2026-08-10T20:44:01.883Z",
  "idSubprogram": 1396,
  "idSchool": 9458,
  "idBudget": 338067,
  "idSupplier": 45217
}
```

Detalhe do mesmo registro:

URL:

`GET https://transparencia-api.caixaescolar.educacao.mg.gov.br/public/purchase-orders/by-subprogram/1396/by-school/9458/by-budget/338067/detail?portalSlug=mg`

Amostra:

```json
{
  "budgetOrder": "2027075592",
  "purchaseOrderStatus": "ENVD",
  "dtProposalSubmission": "2026-08-04T19:06:11.000Z",
  "supplierName": "PADARIA E MERCEARIA SOUTO E MACEDO LTDA",
  "supplierDocument": "07.571.867/0001-46"
}
```

Teste de filtro para fornecedor nulo:

- `idSupplier=null` -> HTTP 400: `idSupplier must be an integer number`.
- `idSupplier=undefined` -> HTTP 400.
- `idSupplier=0` -> ignorado pelo backend; retorna listagem normal com fornecedor preenchido.
- `idSupplier=` -> ignorado pelo backend; retorna listagem normal.

Contagem real dos 5 status pedidos usando `accountabilityStatus={status}`:

| Status | URL | Total real (`meta.total`) | Fornecedor na amostra | Significado prático visto |
|---|---|---:|---|---|
| `AGUA` | `/public/purchase-orders?portalSlug=mg&accountabilityStatus=AGUA&page=1&pageSize=1` | 0 | sem registros | aparece como status possível no frontend, mas não há compra pública nesse status |
| `APRO` | `/public/purchase-orders?portalSlug=mg&accountabilityStatus=APRO&page=1&pageSize=1` | 4 | `idSupplier` preenchido | registro já tem fornecedor e detalhe traz `purchaseOrderStatus: "APRO"` |
| `DILI` | `/public/purchase-orders?portalSlug=mg&accountabilityStatus=DILI&page=1&pageSize=1` | 0 | sem registros | aparece como status possível no frontend, mas não há compra pública nesse status |
| `ENVD` | `/public/purchase-orders?portalSlug=mg&accountabilityStatus=ENVD&page=1&pageSize=1` | 0 | sem registros | aparece como status possível no frontend, mas não há compra pública nesse status |
| `REPR` | `/public/purchase-orders?portalSlug=mg&accountabilityStatus=REPR&page=1&pageSize=1` | 0 | sem registros | aparece como status possível no frontend, mas não há compra pública nesse status |

Status reais dominantes observados na listagem pública:

| Status | URL | Total real (`meta.total`) | Amostra |
|---|---|---:|---|
| `NENV` | `/public/purchase-orders?portalSlug=mg&accountabilityStatus=NENV&page=1&pageSize=1` | 139652 | `idSupplier: 45217`, `accountabilitySent: false` |
| `EMAN` | `/public/purchase-orders?portalSlug=mg&accountabilityStatus=EMAN&page=1&pageSize=1` | 43 | `idSupplier: 112454`, `accountabilitySent: true` |
| `APRO` | `/public/purchase-orders?portalSlug=mg&accountabilityStatus=APRO&page=1&pageSize=1` | 4 | `idSupplier: 83273`, `accountabilitySent: true` |

Limite técnico: a API limita `pageSize` a 100 e não oferece filtro público para `idSupplier IS NULL`. Então a contagem global de fornecedor nulo não é consultável por endpoint público direto. O que é demonstrável sem varrer 1397 páginas: todos os status com volume retornam fornecedor preenchido na amostra, e a própria API pública exige/retorna chaves de fornecedor para detalhe/itens.

## 2. `accountabilityStatus` é status da prestação de contas ou do processo de compra?

É status de prestação de contas, não status do processo de compra.

Evidência de divergência entre campos:

URL listagem:

`GET https://transparencia-api.caixaescolar.educacao.mg.gov.br/public/purchase-orders?portalSlug=mg&accountabilityStatus=EMAN&page=1&pageSize=3`

Amostra da listagem:

```json
{
  "orderId": "2026160420",
  "accountabilityStatus": "EMAN",
  "accountabilitySent": true,
  "purchaseDate": "2026-08-11T17:47:14.421Z",
  "idSubprogram": 648,
  "idSchool": 8489,
  "idBudget": 336006,
  "idSupplier": 112454
}
```

URL detalhe:

`GET https://transparencia-api.caixaescolar.educacao.mg.gov.br/public/purchase-orders/by-subprogram/648/by-school/8489/by-budget/336006/detail?portalSlug=mg`

Amostra do detalhe:

```json
{
  "budgetOrder": "2026160420",
  "purchaseOrderStatus": "ENVD",
  "dtProposalSubmission": "2026-08-10T09:57:04.115Z",
  "supplierName": "63.239.353 RAPHAELA LIMA ABIDONE",
  "supplierDocument": "63.239.353/0001-69"
}
```

Conclusão: o mesmo registro tem `accountabilityStatus: "EMAN"` na listagem e `purchaseOrderStatus: "ENVD"` no detalhe. Se fosse status de compra, os campos deveriam coincidir. Além disso `accountabilitySent` acompanha esse campo, reforçando que é prestação de contas.

## 3. Existe `dtProposalSubmission` futura?

Não encontrei em registros recentes, e a API pública não permite filtrar/ordenar por `dtProposalSubmission`.

Tentativa de ordenação direta:

URL:

`GET https://transparencia-api.caixaescolar.educacao.mg.gov.br/public/purchase-orders?portalSlug=mg&page=1&pageSize=20&sortBy=dtProposalSubmission&sortDir=DESC`

Resposta:

```json
{
  "message": [
    "sortBy must be one of the following values: orderId, year, school, subprogram, company, dtPurchaseOrder, expenseGroup, accountabilityStatus"
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```

Teste feito:

- Ordenei pela compra mais recente: `sortBy=dtPurchaseOrder&sortDir=DESC`.
- Busquei detalhe dos 100 primeiros registros.
- Corte usado: `2026-08-12T00:00:00-03:00`.
- Resultado: `futureCount = 0`.

Amostra mais recente checada:

URL listagem:

`GET https://transparencia-api.caixaescolar.educacao.mg.gov.br/public/purchase-orders?portalSlug=mg&page=1&pageSize=100&sortBy=dtPurchaseOrder&sortDir=DESC`

Exemplo de detalhe:

```json
{
  "purchaseDate": "2026-08-12T14:42:38.345Z",
  "dtProposalSubmission": "2026-08-10T09:57:04.115Z",
  "supplierName": "63.239.353 RAPHAELA LIMA ABIDONE",
  "supplierDocument": "63.239.353/0001-69"
}
```

Conclusão: para os 100 registros mais recentes, nenhum ainda estava aceitando proposta pela data de envio; todos já tinham fornecedor.

## 4. Existe portal/endpoint público sem login para cotações abertas?

Não encontrei endpoint público sem login que liste oportunidades abertas para fornecedor se candidatar.

### Bundle da transparência

Base pública:

`https://transparencia-api.caixaescolar.educacao.mg.gov.br`

Endpoints encontrados:

- `/public/purchase-orders`
- `/public/purchase-orders/.../detail`
- `/public/purchase-orders/.../items`
- `/public/purchase-orders/.../images`
- `/public/portal/filters`
- `/public/indicators/summary`
- `/public/indicators/bars`
- `/public/networks/portal-info`

Nenhum endpoint público de orçamento aberto/proposta/cotação.

### Bundle do portal principal

Base interna:

`https://api.caixaescolar.educacao.mg.gov.br`

Rotas de compras no Angular:

```js
[
  { path: "solicitar-orcamento", canActivate: [it] },
  { path: "orcamento/subprograma/:idSubprogram/escola/:idSchool/detalhe-orcamento/:idBudget", canActivate: [it] },
  { path: "orcamento/subprograma/:idSubprogram/escola/:idSchool/detalhe-orcamento/:idBudget/proposta-fornecedor/:idSupplier", canActivate: [it] },
  { path: "orcamentos", canActivate: [it] },
  { path: "analise-orcamento", canActivate: [it] },
  { path: "ordem-compra", canActivate: [it] }
]
```

Serviços internos relevantes encontrados:

```text
budget
budget-item
budget-proposal
budget-proposal-item
budget/send-proposal/by-subprogram/{idSubprogram}/by-school/{idSchool}/by-budget/{idBudget}
budget/summary-by-supplier-profile
budget/summary-by-supplier-profile/counters
```

Teste sem login:

```text
GET https://api.caixaescolar.educacao.mg.gov.br/budget?filter.status=$eq:ENVI&page=1&limit=5
HTTP 401
{"message":"Senha ou usuário incorretos","error":"Unauthorized","statusCode":401}
```

```text
GET https://api.caixaescolar.educacao.mg.gov.br/supplier/register/MG
HTTP 401
{"message":"Senha ou usuário incorretos","error":"Unauthorized","statusCode":401}
```

### Subdomínios óbvios

```text
https://fornecedor.caixaescolar.educacao.mg.gov.br/ -> DNS não resolve
https://compras.caixaescolar.educacao.mg.gov.br/ -> DNS não resolve
https://cotacao.caixaescolar.educacao.mg.gov.br/ -> DNS não resolve
```

`https://sgd.municipios.fgv.br/` responde uma SPA genérica do SGD, mas o grep dos bundles baixados não revelou endpoint público de oportunidades abertas. O fluxo continua sendo login/cadastro.

### Links públicos SEE/SRE

Página da SRE São Sebastião do Paraíso:

`https://sressparaiso.educacao.mg.gov.br/licitacoes/contratacao-de-obras/`

Evidência textual pública:

- diz que fornecedores acessam solicitações de compras e cadastram propostas diretamente na plataforma SGD;
- linka `https://caixaescolar.educacao.mg.gov.br/selecionar-perfil`;
- informa que, a partir de 2026, processos de aquisição das Caixas Escolares não são publicados no site da SRE por causa da implantação do SGD; as aquisições serão realizadas e divulgadas dentro do SGD.

Busca pública também encontrou páginas de SREs orientando fornecedores a acessar o SGD, selecionar perfil `Fornecedor`, cadastrar-se, e consultar processos ativos pelo menu `Compras`, usando filtros por município ou escola. Não apareceu API pública sem login.

## 5. Se for só via login: o que é visível sem login?

Visível sem login:

### Seleção de perfil

URL:

`https://caixaescolar.educacao.mg.gov.br/selecionar-perfil`

HTTP:

```text
HTTP/2 200
content-type: text/html
title: MG - SGD
```

O conteúdo é SPA; o texto indexado mostra perfis: `Fornecedor`, `Escola`, `Secretaria de Educação`.

### Login fornecedor

URL:

`https://caixaescolar.educacao.mg.gov.br/login?profile=FORN`

HTTP:

```text
HTTP/2 200
content-type: text/html
title: MG - SGD
```

Texto do bundle:

```text
Digite seus dados Cadastrais ou clique em "Cadastre-se" Para darmos início no seu registro
```

### Cadastro fornecedor

No bundle de login:

```js
openRegistrationModal() {
  this.modalService.open(He, { size: "md", centered: true, backdrop: "static" })
}
```

Modal de cadastro:

```text
Selecione seu tipo Jurídico
Selecione o tipo de cadastro que deseja prosseguir:
Pessoa Física
Pessoa Jurídica
```

Fluxo pós-login do fornecedor no bundle:

```js
if (this.authService.isSupplier()) {
  if (this.authService.user?.coSupplierStatus !== H.VIN) {
    this.router.navigate(["/fornecedor/complemento-cadastro"])
  }
}
```

Rota visível:

`https://caixaescolar.educacao.mg.gov.br/fornecedor/complemento-cadastro`

HTTP sem login:

```text
HTTP/2 200
content-type: text/html
```

Mas é fallback SPA; dados reais dependem de sessão.

### Compras

Rotas existem no bundle, mas todas com guard:

```text
/compras/solicitar-orcamento
/compras/orcamentos
/compras/analise-orcamento
/compras/ordem-compra
```

Sem token, a API interna retorna 401. Não há evidência de acesso público a oportunidades abertas.

## Veredito

**NÃO.**

`/public/purchase-orders` é API de transparência pós-compra/adjudicação: registros vêm com `idSupplier`, detalhe traz `supplierName` e `supplierDocument`, e `dtProposalSubmission` observado é passado.

Oportunidades abertas ficam no SGD autenticado, pelo perfil `Fornecedor`, menu `Compras`, após cadastro/login e aprovação do fornecedor.

