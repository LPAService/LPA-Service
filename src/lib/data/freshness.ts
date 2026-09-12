import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/lib/db/schema";

/**
 * Quando a coleta de cotações terminou pela última vez sem morrer no meio.
 *
 * Existe porque o cabeçalho prometia "em tempo real" sem nada verificar: em
 * setembro/2026 a coleta ficou dias entregando dados velhos (filtro que a API
 * ignorava + timeout de 300s) e a tela continuou dizendo que estava em dia.
 * Promessa que ninguém checa vira mentira silenciosa.
 *
 * "partial" conta: a execução parou no orçamento de tempo, mas gravou o que
 * leu e salvou o cursor. O que não conta é run travado em "running" (processo
 * morto pelo runtime) nem "failed".
 */
export type CollectionFreshness = {
  lastFinishedAt: Date | null;
  status: string | null;
};

const FRESH_MODES = ["open_quotations", "daily_sync"];

export async function loadCollectionFreshness(
  database: NodePgDatabase<typeof schema>
): Promise<CollectionFreshness> {
  try {
    const result = await database.execute<{ finished_at: Date | null; status: string | null }>(sql`
      select finished_at, status
        from collection_runs
       where mode in (${sql.join(FRESH_MODES.map((mode) => sql`${mode}`), sql`, `)})
         and status in ('completed', 'partial')
         and finished_at is not null
       order by finished_at desc
       limit 1
    `);
    const row = result.rows[0];
    if (!row?.finished_at) return { lastFinishedAt: null, status: null };
    return { lastFinishedAt: new Date(row.finished_at), status: row.status };
  } catch {
    // A tela nunca quebra por causa do selo de frescor.
    return { lastFinishedAt: null, status: null };
  }
}

/** Rótulo curto para o card. Sem dado, diz que não sabe — nunca "em dia". */
export function describeFreshness(
  freshness: CollectionFreshness,
  now: Date = new Date()
): { value: string; label: string; stale: boolean } {
  if (!freshness.lastFinishedAt) {
    return { value: "—", label: "coleta sem registro", stale: true };
  }

  const minutes = Math.floor((now.getTime() - freshness.lastFinishedAt.getTime()) / 60_000);
  if (minutes < 0) return { value: "agora", label: "última coleta", stale: false };
  // O cron roda 1x por dia: acima de 36h alguma execução foi perdida.
  const stale = minutes > 36 * 60;

  if (minutes < 1) return { value: "agora", label: "última coleta", stale };
  if (minutes < 60) return { value: `${minutes} min`, label: "última coleta", stale };

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { value: `${hours}h`, label: "última coleta", stale };

  const days = Math.floor(hours / 24);
  return { value: `${days}d`, label: stale ? "coleta atrasada" : "última coleta", stale };
}
