import { Pool } from "pg";
import { classifyOpportunity } from "@/lib/parsing/normalize";
import { summarize } from "@/lib/parsing/summarize";
import categories from "@/lib/classification/categories.json";

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value] = arg.replace(/^--/, "").split("=");
  return [key, value ?? "true"];
}));
const batch = Number(args.get("batch") ?? 500);
const max = args.has("max") ? Number(args.get("max")) : Number.POSITIVE_INFINITY;
const dryRun = args.get("dry-run") === "true";
const force = args.get("force") === "true";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const categoryMap = new Map((categories as Array<{ slug: string; name: string }>).map((c) => [c.slug, c]));
let processed = 0;
let classified = 0;
let fallback = 0;
const distribution = new Map<string, number>();

try {
  while (processed < max) {
    const limit = Math.min(batch, max - processed);
    const condition = force ? "TRUE" : "(o.category_id IS NULL OR o.headline IS NULL OR o.summary IS NULL OR o.top_items IS NULL)";
    const { rows } = await pool.query(`
      SELECT o.id, o.expense_group, o.initiative_description,
             COALESCE(json_agg(json_build_object('order', i.item_order, 'name', i.name, 'description', i.description,
               'unit', i.unit, 'quantity', i.quantity, 'unitValue', i.unit_value, 'totalValue', i.total_value,
               'isPermanent', i.is_permanent, 'expenseCategory', i.expense_category) ORDER BY i.item_order) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
      FROM opportunities o LEFT JOIN items i ON i.opportunity_id = o.id
      WHERE ${condition} GROUP BY o.id ORDER BY o.id LIMIT $1`, [limit]);
    if (!rows.length) break;
    for (const row of rows) {
      const itemNames = (row.items as Array<{ name: string }>).map((item) => item.name);
      const result = classifyOpportunity({ expenseGroup: row.expense_group ?? "", initiativeDescription: row.initiative_description, itemNames });
      const category = categoryMap.get(result.needsFallback ? "outros" : result.categoryId) ?? categoryMap.get("outros")!;
      const summary = summarize({ category: { slug: category.slug, name: category.name, confidence: result.confidence, needsFallback: result.needsFallback }, initiativeDescription: row.initiative_description, expenseGroup: row.expense_group ?? "", items: row.items });
      distribution.set(category.slug, (distribution.get(category.slug) ?? 0) + 1);
      classified += 1;
      if (result.needsFallback) fallback += 1;
      if (!dryRun) await pool.query(`UPDATE opportunities SET category_id = (SELECT id FROM categories WHERE slug = $1), headline = $2, summary = $3, top_items = $4, updated_at = now() WHERE id = $5`, [category.slug, summary.headline, summary.summary, JSON.stringify(summary.topItems), row.id]);
    }
    processed += rows.length;
    console.log(`processed=${processed} classified=${classified} fallback=${fallback}`);
  }
  console.log(JSON.stringify({ processed, classified, fallback, dryRun, distribution: Object.fromEntries(distribution) }, null, 2));
} finally { await pool.end(); }
