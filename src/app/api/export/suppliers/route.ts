import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { csvRow, formatDecimal } from "@/lib/export/csv";
import { csvDownloadHeaders } from "@/lib/export/http";

export const runtime = "nodejs";

type SupplierExportRow = {
  supplier: string;
  cnpj: string;
  city: string | null;
  total_orders: number;
  total_value: number;
  categories: string | null;
  products: string | null;
};

export async function GET() {
  const result = await db.execute<SupplierExportRow>(sql`
    select
      s.name as supplier,
      s.document as cnpj,
      s.city,
      s.total_orders,
      s.total_value,
      (
        select string_agg(category_rows.name, '; ' order by category_rows.name)
        from (
          select distinct c.name
          from supplier_categories sc
          join categories c on c.id = sc.category_id
          where sc.supplier_id = s.id
        ) category_rows
      ) as categories,
      (
        select string_agg(product_rows.product_name, '; ' order by product_rows.times_supplied desc, product_rows.product_name)
        from (
          select product_name, times_supplied
          from supplier_products sp
          where sp.supplier_id = s.id
          order by times_supplied desc, product_name
          limit 10
        ) product_rows
      ) as products
    from suppliers s
    order by s.total_value desc, s.name
  `);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`\uFEFF${csvRow(["fornecedor", "cnpj", "cidade", "total_pedidos", "valor_total", "categorias_atendidas", "principais_produtos"])}`));
      for (const row of result.rows) {
        controller.enqueue(encoder.encode(csvRow([
          row.supplier,
          row.cnpj,
          row.city,
          row.total_orders,
          formatDecimal(row.total_value),
          row.categories,
          row.products
        ])));
      }
      controller.close();
    }
  });

  return new Response(stream, { headers: csvDownloadHeaders("fornecedores") });
}
