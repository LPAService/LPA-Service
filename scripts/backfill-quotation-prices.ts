import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import { parseReferencePrice } from "@/lib/parsing/reference-price";

const envFile = resolve(process.cwd(), ".env");
if (existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

type ItemRow = {
  id: number;
  quotation_id: number;
  description: string;
  quantity: number;
  reference_value: number | null;
};

try {
  await pool.query("begin");
  const before = await pool.query<{ total: number }>("select count(*)::int as total from quotations where total_reference_value is not null");
  const items = await pool.query<ItemRow>("select id, quotation_id, description, quantity, reference_value from quotation_items order by quotation_id, item_order");

  let gainedPrice = 0;
  let withoutPrice = 0;
  let deliberateNullAmbiguous = 0;
  let deliberateNullDifferentBasis = 0;
  const quotationIds = new Set<number>();

  for (const item of items.rows) {
    const parsed = parseReferencePrice(item.description);
    if (parsed.value === null) {
      if (item.reference_value !== null && (parsed.reason === "ambiguous" || parsed.reason === "different-basis")) {
        await pool.query("update quotation_items set reference_value = null where id = $1", [item.id]);
      }
      if (parsed.reason === "ambiguous") deliberateNullAmbiguous += 1;
      if (parsed.reason === "different-basis") deliberateNullDifferentBasis += 1;
      if (item.reference_value === null) withoutPrice += 1;
      quotationIds.add(item.quotation_id);
      continue;
    }

    if (item.reference_value !== parsed.value) {
      await pool.query("update quotation_items set reference_value = $1 where id = $2", [parsed.value, item.id]);
      if (item.reference_value === null) gainedPrice += 1;
    }
    quotationIds.add(item.quotation_id);
  }

  await pool.query(`
    update quotations q
    set total_reference_value = totals.total_value, updated_at = now()
    from (
      select quotation_id, sum(quantity * reference_value)::double precision as total_value
      from quotation_items
      where reference_value is not null
      group by quotation_id
    ) totals
    where q.id = totals.quotation_id
      and q.total_reference_value is distinct from totals.total_value
  `);

  await pool.query(`
    update quotations q
    set total_reference_value = null, updated_at = now()
    where q.id = any($1::int[])
      and not exists (
        select 1 from quotation_items qi
        where qi.quotation_id = q.id and qi.reference_value is not null
      )
      and q.total_reference_value is not null
  `, [[...quotationIds]]);

  const after = await pool.query<{ total: number }>("select count(*)::int as total from quotations where total_reference_value is not null");
  await pool.query("commit");

  console.log(JSON.stringify({
    itemsGainedPrice: gainedPrice,
    itemsWithoutPrice: withoutPrice,
    quotationsWithTotalBefore: before.rows[0]?.total ?? 0,
    quotationsWithTotalAfter: after.rows[0]?.total ?? 0,
    quotationsGainedTotal: (after.rows[0]?.total ?? 0) - (before.rows[0]?.total ?? 0),
    deliberateNullAmbiguous,
    deliberateNullDifferentBasis,
    deliberateNullTotal: deliberateNullAmbiguous + deliberateNullDifferentBasis
  }, null, 2));
} catch (error) {
  await pool.query("rollback");
  throw error;
} finally {
  await pool.end();
}
