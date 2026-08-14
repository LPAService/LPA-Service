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
