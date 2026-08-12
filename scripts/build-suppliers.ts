import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import { normalizar } from "@/lib/classification/classify";
import { normalizeProductName, preferredName } from "@/lib/suppliers/aggregate";

const envFile = resolve(process.cwd(), ".env");
if (existsSync(envFile) && typeof process.loadEnvFile === "function") process.loadEnvFile(envFile);

type ProductRow = {
  document: string;
  productName: string;
  categoryId: number | null;
  timesSupplied: number;
  totalQuantity: number;
  avgUnitValue: number | null;
  minUnitValue: number | null;
  maxUnitValue: number | null;
  lastSuppliedAt: Date | null;
};

type SupplierRow = {
  document: string;
  name: string;
  city: string;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  totalOrders: number;
  totalValue: number;
};

type CategoryRow = {
  document: string;
  categoryId: number;
  orderCount: number;
  totalValue: number;
};

const args = new Set(process.argv.slice(2));
const cities = (process.argv.find((arg) => arg.startsWith("--cities="))?.slice(9) ?? "Belo Horizonte,Ibirité")
  .split(",")
  .map((city) => city.trim())
  .filter(Boolean);
const max = Number(process.argv.find((arg) => arg.startsWith("--max="))?.slice(6) ?? "0");
const dryRun = args.has("--dry-run");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const scoped = `o.city = ANY($1::text[]) AND o.supplier_document IS NOT NULL AND btrim(o.supplier_document) <> ''`;
  const limit = Number.isFinite(max) && max > 0 ? "LIMIT $2" : "";
  const supplierResult = await pool.query<SupplierRow>(
    `WITH scoped AS (
       SELECT o.* FROM opportunities o WHERE ${scoped} ORDER BY o.id ${limit}
     ), ranked_cities AS (
       SELECT supplier_document, city, count(*) AS sales,
         row_number() OVER (PARTITION BY supplier_document ORDER BY count(*) DESC, city) AS position
       FROM scoped GROUP BY supplier_document, city
     )
     SELECT s.supplier_document AS document,
       (array_agg(s.supplier_name ORDER BY length(s.supplier_name), s.supplier_name))[1] AS name,
       (array_agg(rc.city ORDER BY rc.position))[1] AS city,
       min(s.purchase_date) AS "firstSeenAt", max(s.purchase_date) AS "lastSeenAt",
       count(*)::int AS "totalOrders", coalesce(sum(s.total_value), 0)::float8 AS "totalValue"
     FROM scoped s JOIN ranked_cities rc ON rc.supplier_document = s.supplier_document AND rc.position = 1
     GROUP BY s.supplier_document`,
    max > 0 ? [cities, max] : [cities]
  );

  const supplierIds = new Map<string, number>();
  if (!dryRun) {
    for (const row of supplierResult.rows) {
      const result = await pool.query(
        `INSERT INTO suppliers (document, name, normalized_name, city, first_seen_at, last_seen_at, total_orders, total_value, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
         ON CONFLICT (document) DO UPDATE SET name=excluded.name, normalized_name=excluded.normalized_name,
           city=excluded.city, first_seen_at=excluded.first_seen_at, last_seen_at=excluded.last_seen_at,
           total_orders=excluded.total_orders, total_value=excluded.total_value, updated_at=now()
         RETURNING id`,
        [row.document, row.name, normalizar(row.name), row.city, row.firstSeenAt, row.lastSeenAt, row.totalOrders, row.totalValue]
      );
      supplierIds.set(row.document, result.rows[0].id);
    }
  }

  const productResult = await pool.query<ProductRow>(
    `SELECT o.supplier_document AS document, i.name AS "productName", o.category_id AS "categoryId",
       count(*)::int AS "timesSupplied", coalesce(sum(i.quantity), 0)::float8 AS "totalQuantity",
       avg(i.unit_value)::float8 AS "avgUnitValue", min(i.unit_value)::float8 AS "minUnitValue",
       max(i.unit_value)::float8 AS "maxUnitValue", max(o.purchase_date) AS "lastSuppliedAt"
     FROM opportunities o JOIN items i ON i.opportunity_id = o.id
     WHERE ${scoped} GROUP BY o.supplier_document, i.name, o.category_id`,
    [cities]
  );
  const groupedProducts = new Map<string, ProductRow[]>();
  for (const row of productResult.rows) {
    const key = `${row.document}\u0000${normalizeProductName(row.productName)}`;
    groupedProducts.set(key, [...(groupedProducts.get(key) ?? []), row]);
  }
  if (!dryRun) for (const [key, rows] of groupedProducts) {
    const [document, normalizedProductName] = key.split("\u0000");
    const supplierId = supplierIds.get(document);
    if (!supplierId) continue;
    const values = rows.flatMap((row) => Array(row.timesSupplied).fill(row.avgUnitValue).filter((value): value is number => value !== null));
    const categoryId = rows.sort((a, b) => b.timesSupplied - a.timesSupplied)[0].categoryId;
    await pool.query(
      `INSERT INTO supplier_products (supplier_id, product_name, normalized_product_name, category_id, times_supplied, total_quantity, avg_unit_value, min_unit_value, max_unit_value, last_supplied_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (supplier_id, normalized_product_name) DO UPDATE SET product_name=excluded.product_name,
         category_id=excluded.category_id, times_supplied=excluded.times_supplied, total_quantity=excluded.total_quantity,
         avg_unit_value=excluded.avg_unit_value, min_unit_value=excluded.min_unit_value,
         max_unit_value=excluded.max_unit_value, last_supplied_at=excluded.last_supplied_at`,
      [supplierId, preferredName(rows.map((row) => row.productName)), normalizedProductName, categoryId,
        rows.reduce((sum, row) => sum + row.timesSupplied, 0), rows.reduce((sum, row) => sum + row.totalQuantity, 0),
        values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
        values.length ? Math.min(...values) : null, values.length ? Math.max(...values) : null,
        rows.reduce<Date | null>((latest, row) => !latest || (row.lastSuppliedAt && row.lastSuppliedAt > latest) ? row.lastSuppliedAt : latest, null)]
    );
  }

  const categoryResult = await pool.query<CategoryRow>(
    `SELECT o.supplier_document AS document, o.category_id AS "categoryId", count(*)::int AS "orderCount",
       coalesce(sum(o.total_value), 0)::float8 AS "totalValue"
     FROM opportunities o WHERE ${scoped} AND o.category_id IS NOT NULL
     GROUP BY o.supplier_document, o.category_id`, [cities]
  );
  if (!dryRun) for (const row of categoryResult.rows) {
    const supplierId = supplierIds.get(row.document);
    if (!supplierId) continue;
    await pool.query(
      `INSERT INTO supplier_categories (supplier_id, category_id, order_count, total_value) VALUES ($1,$2,$3,$4)
       ON CONFLICT (supplier_id, category_id) DO UPDATE SET order_count=excluded.order_count, total_value=excluded.total_value`,
      [supplierId, row.categoryId, row.orderCount, row.totalValue]
    );
  }
  console.log(JSON.stringify({ dryRun, cities, suppliers: supplierResult.rowCount, products: groupedProducts.size, categories: categoryResult.rowCount }));
} finally {
  await pool.end();
}
