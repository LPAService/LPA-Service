# AGENTS

## Contexto do Produto

SaaS que transforma oportunidades publicadas no portal Caixa Escolar MG em cards comerciais simples para fornecedores. Fornecedor deve entender rapidamente escola, cidade, prazo, itens, resumo e categoria sem abrir processo por processo.

Fonte principal: https://caixaescolar.educacao.mg.gov.br/

Campos reais da fonte ainda estão em mapeamento. Preserve `raw_json` como válvula de escape para migrações futuras.

## Regra Caveman Obrigatória

Toda resposta de agente deve usar caveman full: sem introdução, sem elogio, sem repetição e sem relatório gigante. Código, comandos, erros e dados técnicos ficam completos.

## Formato de Relatório

Use exatamente:

```text
STATUS: DONE|BLOCKED|FAILED
REALIZADO: (curto)
ARQUIVOS: (lista)
TESTES: (comandos rodados + resultado real)
PROBLEMAS: (só se existirem)
PRÓXIMO: (próxima ação recomendada)
```

## Regra de Branch

Commit direto em `main` foi permitido somente no bootstrap inicial. Após bootstrap, criar branch de trabalho antes de qualquer alteração:

```bash
git checkout -b <tipo>/<descricao-curta>
```

Não fazer commit direto em `main`.

## Mapa de Pastas por Domínio

- `src/app`: App Router e dashboard.
- `src/lib/db`: Drizzle ORM, schema, conexão, migrações.
- `src/lib/collector`: coleta da fonte Caixa Escolar MG.
- `src/lib/classification`: normalização e categorização comercial.
- `src/lib/parsing`: extração e parsing de textos, itens, quantidades e unidades.
- `tests`: testes unitários e integração.

## Áreas Bloqueadas

Não mexer em `.grok/`, `.overclock-app/` ou `research/` sem pedido explícito.

