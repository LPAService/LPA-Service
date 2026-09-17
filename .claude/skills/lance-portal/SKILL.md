---
name: lance-portal
description: Use quando o humano pedir para fazer, montar, preencher ou conferir lance, proposta ou pre-orcamento no portal Caixa Escolar MG/SGD.
---

# Lance Portal Caixa Escolar MG

Use esta skill para preencher proposta no portal Caixa Escolar MG/SGD a partir de um pre-orcamento do LPA_Leo.

Enviar proposta e lance vinculante em licitacao publica. Envio e sempre decisao do humano. O portal separa `update-proposal` de `send-proposal`; esta skill faz somente preenchimento/salvamento de dados de proposta, nunca envio.

Nunca use `alert`, `confirm` ou `prompt` na pagina. Essas chamadas travam a extensao Claude in Chrome.

Se o mesmo passo falhar 2 ou 3 vezes, pare e pergunte ao humano. Nao tente variacoes indefinidamente.

Nunca invente valor, nunca corrija preco, nunca preencha item que nao veio no payload.

## Procedimento

1. Confirme pre-condicao: a aba do portal ja precisa estar autenticada.
   - Nunca lide com login, senha, token, certificado ou qualquer credencial.
   - Se o portal nao estiver logado, pare e peca ao humano para entrar no portal. Retome somente depois.

2. Busque o payload do pre-orcamento no app:
   - Chame `GET {APP}/api/prequotes/<id>/proposta`.
   - Em `200`, use `{ proposta, portal: { proposalUrl, orderId, quotationExternalId } }`.
   - Em `409`, mostre `blockers` ao humano e pare. Nao comece proposta pela metade.
   - Em qualquer outro erro, reporte status/corpo e pare.

3. Inspecione abas abertas:
   - Use `tabs_context_mcp` para ver contexto atual.
   - Nao abra `portal.proposalUrl` direto com `tabs_create_mcp`. Medido no portal real em 17/09/2026: carregar URL de orcamento direto na barra derruba a rota Angular e joga na home `https://caixaescolar.educacao.mg.gov.br/`.
   - Se ja existir aba autenticada do portal, use essa aba. Se nao existir, abra `https://caixaescolar.educacao.mg.gov.br/` e confirme login; se cair em login ou `/selecionar-perfil`, pare e peca ao humano para entrar no portal.
   - Navegue dentro do app do portal: menu `Compras`, item `Orcamento`. A tela esperada e `/compras/orcamentos`.
   - No campo `ID Orcamento` com placeholder `Digite o ID do orcamento`, preencha `portal.orderId`. Esse valor e o `nuBudgetOrder`, por exemplo `2026200309`; nao use `portal.quotationExternalId` nessa busca.
   - Clique `Buscar` e espere a tabela carregar. A tabela mostra spinner; os contadores do topo podem aparecer antes das linhas, entao aguarde a linha do orcamento existir.
   - Na linha do orcamento, localize o botao `Editar` por elemento/texto. Nunca clique por coordenada cega: `Excluir` fica colado em `Editar`, e a linha tambem tem `Visualizar`.
   - Antes de clicar, cheque se `Editar` esta habilitado. Se `Editar` estiver com `disabled=true`, pare e diga ao humano que o cadastro do fornecedor nao esta habilitado para editar proposta; o humano pode conferir em `Fornecedor` -> `Situacao de Cadastro`.
   - Clique `Editar` somente se habilitado.
   - Depois da navegacao, se a URL/tela nao for a tela do orcamento/proposta esperada, pare. Home `/` e `/selecionar-perfil` sao casos conhecidos, mas a regra vale para qualquer tela diferente da esperada. Nao tente adivinhar a URL do orcamento na mao.

4. Confirme que a pagina certa carregou:
   - Use `read_page`.
   - A tela precisa ser `Cadastrar Proposta`.
   - Confira o numero do orcamento na pagina contra `portal.quotationExternalId`.
   - Se o numero for diferente, pare. Nao preencha outro orcamento.

5. Gere e rode o injetavel em dry-run:
   - Gere o JS com:
     ```bash
     node scripts/portal/injetavel.mjs '<json da proposta>' --dry-run
     ```
   - Rode o JS gerado com `javascript_tool`.
   - Leia o retorno de `preencherProposta`: `{ dryRun, encontrados, textosPreenchidos, paraDigitar, faltando, divergencias }`.
   - Use dry-run para saber quantos itens existem na pagina e o que falta antes de escrever qualquer coisa.
   - Se houver `divergencias`, reporte e pare.

6. Preencha textos no modo real:
   - Gere o JS sem `--dry-run`:
     ```bash
     node scripts/portal/injetavel.mjs '<json da proposta>'
     ```
   - Rode com `javascript_tool`.
   - Guarde `paraDigitar`.
   - O retorno esperado de `preencherProposta` e `{ dryRun, encontrados, textosPreenchidos, paraDigitar: [{ itemOrder, campoId, digitos, valor }], faltando: [{ itemOrder, nome, motivo }], divergencias }`.
   - Se houver `divergencias`, reporte e pare.

7. Digite valores monetarios com teclado real:
   - Para cada entrada de `paraDigitar`, clique no campo `campoId`.
   - Limpe o campo se necessario.
   - Digite `digitos` usando a ferramenta de teclado `computer`.
   - Nao atribua `input.value` por JS para campo de valor.
   - Motivo: atribuir `input.value` deixa o numero visivel, mas o Angular nao registra no modelo. O campo `totalValue` fica `R$ 0,00` e o lance sai vazio. A mascara so reage a digitacao real; por exemplo, digitar `"690"` vira `R$ 6,90`.

8. Confira o que o Angular registrou:
   - Gere o JS com:
     ```bash
     node scripts/portal/injetavel.mjs '<json da proposta>' --conferir
     ```
   - Rode com `javascript_tool`.
   - Leia `conferirProposta`: `{ ok, itens: [{ itemOrder, esperado, lido, ok }], faltando, divergencias }`.
   - Se `ok:false`, pare e reporte item a item: `itemOrder`, `esperado`, `lido`, `ok` e divergencias.
   - A prova de valor correto e `totalValue`, nao o texto do input de valor.

9. Trate itens faltando:
   - Se `faltando` contiver somente motivo `"fora-desta-pagina"`, navegue para a proxima pagina de itens no portal e repita os passos 5 a 8.
   - Se qualquer item tiver motivo `"inexistente"`, pare e reporte `itemOrder`, `nome` e `motivo`.
   - Nao preencha item fora do payload.

10. Pare na tela preenchida:
    - Nunca marque aceite.
    - Nunca clique em enviar.
    - Nunca feche a aba.
    - Relate ao humano:
      - total do portal;
      - total do pre-orcamento;
      - conferencia item a item;
      - frase obrigatoria: `Falta voce revisar e clicar Enviar no portal.`

## O Que Esta Skill NAO Faz

- Nao faz login.
- Nao pede, le, salva ou manipula senha, token, certificado ou credencial.
- Nao envia proposta.
- Nao marca aceite.
- Nao clica em `Enviar`, `send-proposal` ou equivalente.
- Nao fecha aba do portal.
- Nao inventa item, preco, quantidade, unidade, garantia ou observacao.
- Nao altera preco para fazer total bater.
- Nao usa `alert`, `confirm` ou `prompt`.
- Nao continua quando o endpoint retorna `409`.
- Nao continua quando o orcamento na tela diverge de `portal.quotationExternalId`.
- Nao aprova conferencia lendo apenas o texto do input de valor; precisa conferir `totalValue`.
