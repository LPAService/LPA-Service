import { existsSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { analyzeProposalBlock } from "@/lib/collector/proposal-block";

const envFile = resolve(process.cwd(), ".env");
if (existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

const dryRun = process.argv.includes("--dry-run");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL não definido");

type Row = {
  quotation_id: number;
  external_id: string;
  budget_status: string | null;
  supplier_status: string | null;
  proposal_deadline: Date | null;
  description: string;
};

const pool = new pg.Pool({ connectionString: databaseUrl });

try {
  const result = await pool.query<Row>(`
    select q.id as quotation_id, q.external_id, q.budget_status, q.supplier_status, q.proposal_deadline, qi.description
    from quotations q
    join quotation_items qi on qi.quotation_id = q.id
    order by q.id, qi.item_order
  `);

  const grouped = new Map<number, Row[]>();
  for (const row of result.rows) grouped.set(row.quotation_id, [...(grouped.get(row.quotation_id) ?? []), row]);

  let blocked = 0;
  let suspect = 0;
  let openBlocked = 0;
  let changed = 0;

  for (const [quotationId, rows] of grouped) {
    const analysis = analyzeProposalBlock(rows.map((row) => ({ description: row.description })));
    if (analysis.blocked) blocked += 1;
    if (analysis.suspect) suspect += 1;
    const first = rows[0]!;
    const isOpen = first.proposal_deadline ? first.proposal_deadline.getTime() >= Date.now() : false;
    if (analysis.blocked && isOpen) openBlocked += 1;
    if (dryRun) continue;

    const update = await pool.query(
      `
        update quotations
        set proposal_blocked = $2,
            proposal_blocked_reason = $3,
            proposal_blocked_item_count = $4,
            proposal_suspect = $5,
            proposal_suspect_item_count = $6,
            updated_at = now()
        where id = $1
          and (
            proposal_blocked is distinct from $2
            or proposal_blocked_reason is distinct from $3
            or proposal_blocked_item_count is distinct from $4
            or proposal_suspect is distinct from $5
            or proposal_suspect_item_count is distinct from $6
          )
      `,
      [quotationId, analysis.blocked, analysis.reason, analysis.blockedItemCount, analysis.suspect, analysis.suspectItemCount]
    );
    changed += update.rowCount ?? 0;
  }

  console.log(JSON.stringify({ dryRun, quotationsScanned: grouped.size, blocked, suspect, openBlocked, changed }));
} finally {
  await pool.end();
}
