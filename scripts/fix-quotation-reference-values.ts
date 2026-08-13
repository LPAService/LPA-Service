import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

const envFile = resolve(process.cwd(), ".env");
if (existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL não definida. Crie um .env (veja .env.example) ou exporte a variável antes de rodar."
  );
}

const dryRun = process.argv.includes("--dry-run");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const badQuotationWhere = `
  q.total_reference_value is not null
  and exists (
    select 1 from quotation_items qi where qi.quotation_id = q.id
  )
  and not exists (
    select 1 from quotation_items qi
    where qi.quotation_id = q.id and qi.reference_value is not null
  )
`;

try {
  const before = await countBadQuotations();
  let updated = 0;
  if (!dryRun) {
    const result = await pool.query(`
      update quotations q
      set total_reference_value = null, updated_at = now()
      where ${badQuotationWhere}
    `);
    updated = result.rowCount ?? 0;
  }
  const after = dryRun ? before : await countBadQuotations();
  console.log(JSON.stringify({ badBefore: before, updated, badAfter: after, dryRun }, null, 2));
} finally {
  await pool.end();
}

async function countBadQuotations() {
  const result = await pool.query<{ total: number }>(`
    select count(*)::int as total
    from quotations q
    where ${badQuotationWhere}
  `);
  return result.rows[0]?.total ?? 0;
}
