# LPA Leo

## Produto

SaaS que transforma compras de escolas públicas de MG (portal Caixa Escolar MG) em cards comerciais simples para fornecedores. O fornecedor entende escola, cidade, prazo, itens, resumo e categoria sem abrir processo por processo.

## Fonte de dados

API pública de transparência, sem autenticação:

```
https://transparencia-api.caixaescolar.educacao.mg.gov.br
```

Contrato dos endpoints em `research/portal/recon.md`.

> **Aviso importante:** essa API expõe compras **já adjudicadas** — processos que já têm fornecedor vencedor. Não são oportunidades abertas. Oportunidades abertas ficam no SGD autenticado; detalhes em `research/portal/open-opportunities.md`.

## Setup local

Sem Docker nesta máquina — PostgreSQL via Homebrew.

```bash
psql -d postgres -c "CREATE ROLE lpa LOGIN PASSWORD 'lpa' CREATEDB;"
createdb -O lpa lpa_leo
createdb -O lpa lpa_leo_test
```

Copie `.env.example` para `.env`:

```
DATABASE_URL=postgres://lpa:lpa@localhost:5432/lpa_leo
TEST_DATABASE_URL=postgres://lpa:lpa@localhost:5432/lpa_leo_test
```

Dependências e migrações:

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
```

Testes de banco usam `lpa_leo_test` e podem dropar/truncar somente esse banco.

## Scripts

| Script | Comando |
|---|---|
| dev | `pnpm dev` |
| build | `pnpm build` |
| lint | `pnpm lint` |
| typecheck | `pnpm typecheck` |
| test | `pnpm test` |
| db:generate | `pnpm db:generate` |
| db:migrate | `pnpm db:migrate` |

## Mapa de pastas por domínio

- `src/app`: App Router e dashboard.
- `src/lib/db`: Drizzle ORM, schema, conexão, migrações.
- `src/lib/collector`: coleta da fonte Caixa Escolar MG.
- `src/lib/classification`: normalização e categorização comercial.
- `src/lib/parsing`: extração e parsing de textos, itens, quantidades e unidades.
- `research/`: reconhecimento da fonte, taxonomia e laudos de revisão.
- `tests`: testes unitários e integração.
