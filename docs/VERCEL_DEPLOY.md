# Deploy no Vercel - Auth com NextAuth.js

## Pré-requisitos
- Conecte o repositório GitHub ao Vercel
- PostgreSQL (Neon ou local)

## Passos de Deploy
1. Conecte o repo ao Vercel
2. Defina as variáveis de ambiente:
   - `DATABASE_URL` (PostgreSQL connection string)
   - `NEXTAUTH_SECRET` (gerado com `openssl rand -base64 32`)
   - `NEXTAUTH_URL` (URL de produção do Vercel, ex: https://seusite.vercel.app)
   - `CRON_SECRET` — segredo usado pela Vercel Cron e exigido por `/api/cron/sync` (sem ele o endpoint responde 401 e a coleta nunca roda).
   - `SGD_LOGIN` — CPF/CNPJ do fornecedor pro login no SGD (coleta de cotacoes abertas).
   - `SGD_PASSWORD` — senha do SGD.
   - `DATABASE_URL` — deve apontar pro Postgres de PRODUCAO (Neon), nao localhost.

   Nota: O cron diario (`vercel.json`) so coleta se CRON_SECRET + SGD_LOGIN + SGD_PASSWORD estiverem setadas no projeto Vercel de producao.

3. Rode as migrations:
   ```
   corepack pnpm drizzle-kit push
   ```

4. Rode o seed:
   ```
   corepack pnpm tsx scripts/seed-admin.ts
   ```

5. Deploy
   ```
   corepack pnpm build
   corepack pnpm deploy
   ```

## Variáveis no Vercel
- NEXTAUTH_URL: URL de produção
- NEXTAUTH_SECRET: Chave secreta
- CRON_SECRET: segredo usado pela Vercel Cron e exigido por `/api/cron/sync` (sem ele o endpoint responde 401 e a coleta nunca roda).
- SGD_LOGIN: CPF/CNPJ do fornecedor pro login no SGD (coleta de cotacoes abertas).
- SGD_PASSWORD: senha do SGD.
- DATABASE_URL: deve apontar pro Postgres de PRODUCAO (Neon), nao localhost.

Nota: O cron diario (`vercel.json`) so coleta se CRON_SECRET + SGD_LOGIN + SGD_PASSWORD estiverem setadas no projeto Vercel de producao.
