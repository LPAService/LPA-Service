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
| sync:daily | `pnpm exec tsx scripts/sync-daily.ts` |

## Sincronização diária

`/api/cron/sync` coleta incrementalmente os 34 municípios da RMBH. Cada município tem isolamento de erro: falha de uma cidade é registrada em `collection_runs.errors` e não interrompe as demais. A rota processa enquanto houver tempo de execução e uma próxima passagem incremental retoma dados ainda não visitados.

Defina segredo forte no ambiente de produção e local:

```bash
CRON_SECRET=valor-longo-e-aleatorio
```

Chame rota com `Authorization: Bearer $CRON_SECRET` ou `?secret=$CRON_SECRET`. `/api/cron/status` usa mesma proteção e lista execuções recentes, incluindo duração e erros.

Na Vercel, [vercel.ts](./vercel.ts) agenda `0 9 * * *` UTC, que equivale a 06:00 BRT. Ajuste `DAILY_SYNC_CRON` para mudar horário. Cadastre `CRON_SECRET` nas variáveis do projeto antes do deploy.

Para agendar localmente no macOS, mantenha `.env` com `DATABASE_URL` e `CRON_SECRET`, ajuste caminhos em [scripts/com.lpaleo.sync.plist](./scripts/com.lpaleo.sync.plist) se projeto não estiver em `/Users/haza/Desktop/Projetos/LPA_Leo`, dê permissão ao script e instale agente:

```bash
chmod +x scripts/sync-daily.sh
launchctl bootstrap gui/$(id -u) scripts/com.lpaleo.sync.plist
```

Remove com `launchctl bootout gui/$(id -u)/com.lpaleo.sync`. Logs ficam em `~/Library/Logs/lpa-leo-sync*.log`.

### Status comercial

Fonte pública fornece compras já adjudicadas, não licitações abertas. `dtProposalSubmission` e `dtDelivery` são datas operacionais, mas não provam abertura ou encerramento de uma oportunidade comercial. Por isso produto não deriva `Nova`, `Aberta`, `Encerrando em breve` ou `Encerrada`; inventar esses estados seria enganoso. Status de compra exposto pela fonte continua em `purchase_order_status`.

## Mapa de pastas por domínio

- `src/app`: App Router e dashboard.
- `src/lib/db`: Drizzle ORM, schema, conexão, migrações.
- `src/lib/collector`: coleta da fonte Caixa Escolar MG.
- `src/lib/classification`: normalização e categorização comercial.
- `src/lib/parsing`: extração e parsing de textos, itens, quantidades e unidades.
- `research/`: reconhecimento da fonte, taxonomia e laudos de revisão.
- `tests`: testes unitários e integração.
