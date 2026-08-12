import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import {
  CAIXA_ESCOLAR_API_BASE_URL,
  CAIXA_ESCOLAR_PORTAL_URL
} from "@/lib/source-url";

const envFile = resolve(process.cwd(), ".env");
if (existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const apiPurchaseOrdersBase = `${CAIXA_ESCOLAR_API_BASE_URL}/public/purchase-orders`;
const apiDetailLike =
  `${apiPurchaseOrdersBase}/by-subprogram/%/by-school/%/by-budget/%/detail?portalSlug=mg`;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query("begin");
  const result = await pool.query(
    `
      WITH computed AS (
        SELECT
          id,
          CASE
            WHEN source_url LIKE $3::text THEN source_url
            ELSE concat(
              $2::text,
              '/by-subprogram/',
              id_subprogram,
              '/by-school/',
              id_school,
              '/by-budget/',
              id_budget,
              '/detail?portalSlug=mg'
            )
          END AS source_api_url
        FROM opportunities
      )
      UPDATE opportunities AS o
      SET
        source_url = $1::text,
        raw_json = jsonb_set(
          CASE
            WHEN jsonb_typeof(o.raw_json) = 'object' THEN o.raw_json
            ELSE '{}'::jsonb
          END,
          '{sourceApiUrl}',
          to_jsonb(computed.source_api_url),
          true
        ),
        updated_at = now()
      FROM computed
      WHERE o.id = computed.id
        AND (
          o.source_url IS DISTINCT FROM $1::text
          OR o.raw_json->>'sourceApiUrl' IS DISTINCT FROM computed.source_api_url
        )
      RETURNING o.id
    `,
    [CAIXA_ESCOLAR_PORTAL_URL, apiPurchaseOrdersBase, apiDetailLike]
  );

  if (dryRun) {
    await pool.query("rollback");
  } else {
    await pool.query("commit");
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        updated: result.rowCount,
        sourceUrl: CAIXA_ESCOLAR_PORTAL_URL
      },
      null,
      2
    )
  );
} catch (error) {
  await pool.query("rollback");
  throw error;
} finally {
  await pool.end();
}
