# Detecção de vitória de fornecedor

Data: 2026-09-17

Veredito: dá para detectar vitória com evidência positiva pela transparência pública.

Fonte usada:

- `GET https://transparencia-api.caixaescolar.educacao.mg.gov.br/public/purchase-orders?portalSlug=mg&idSupplier={nosso_supplier_id}&page=N&pageSize=100`

Evidência real:

- Base sem filtro: `HTTP 200`, `meta.total=161291`, amostra com `orderId=2027075623`, `idSupplier=49268`.
- `idSupplier=112454`: `HTTP 200`, `meta.total=1`, retorno `orderId=2026160420`, `idSubprogram=648`, `idSchool=8489`, `idBudget=336006`, `idSupplier=112454`.
- `idSupplier=LIXOXX`: `HTTP 400`, mensagem `idSupplier must be an integer number`. Filtro não foi ignorado.
- `orderId=2026160420`: `HTTP 400`, mensagem `property orderId should not exist`.
- `orderId=LIXOXX`: `HTTP 400`, mensagem `property orderId should not exist`.

Regra implementável:

1. Pegar `our_supplier_id` da cotação enviada (`summary-by-supplier-profile.idSupplier`).
2. Consultar transparência pública paginada por `idSupplier`.
3. Se a resposta trouxer o mesmo `orderId` do bid e `idSupplier` igual ao nosso, marcar `ganho`.
4. Gravar referência da publicação como `purchase-order:{orderId}:subprogram:{idSubprogram}:school:{idSchool}:budget:{idBudget}:supplier:{idSupplier}` e guardar o JSON público bruto.

Limite:

- A API pública não aceita filtro direto por `orderId`; a busca precisa paginar por fornecedor.
- Sem publicação pública positiva, não há vitória: manter `sem_resultado` quando prazo venceu.
