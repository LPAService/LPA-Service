import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { calcPreQuoteTotals } from "@/lib/prequote/calc";
import { bids, preQuoteItems, preQuotes, proposalLosses, quotations } from "@/lib/db/schema";
import * as dbSchema from "@/lib/db/schema";

type BidQuotationRecord = {
  externalId: string;
  nuBudgetOrder: string | null;
  supplierStatus: string | null;
  proposalDeadline: Date | null;
  expenseGroup: string;
  countyName: string | null;
};

type PreQuoteSnapshot = {
  id: number;
  marginPercent: number;
  freightCost: number;
  items: Array<{ quantity: number; unitCost: number | null }>;
};

export async function upsertBidForEnviQuotation(
  database: NodePgDatabase<typeof dbSchema>,
  record: BidQuotationRecord
) {
  if (record.supplierStatus !== "ENVI") return false;
  const orderId = record.nuBudgetOrder?.trim();
  if (!orderId) return false;

  const preQuote = await loadLatestPreQuoteSnapshot(database, record.externalId);
  const totals = preQuote
    ? calcPreQuoteTotals(preQuote.items, preQuote.marginPercent, preQuote.freightCost)
    : null;

  const values = {
    quotationExternalId: record.externalId,
    orderId,
    preQuoteId: preQuote?.id ?? null,
    ourTotal: totals?.suggestedValue ?? null,
    marginPercent: preQuote?.marginPercent ?? null,
    proposalDeadline: record.proposalDeadline,
    expenseGroup: record.expenseGroup,
    countyName: record.countyName,
    updatedAt: new Date()
  };

  await database.insert(bids).values(values).onConflictDoUpdate({
    target: bids.quotationExternalId,
    set: {
      orderId: values.orderId,
      preQuoteId: values.preQuoteId,
      ourTotal: values.ourTotal,
      marginPercent: values.marginPercent,
      proposalDeadline: values.proposalDeadline,
      expenseGroup: values.expenseGroup,
      countyName: values.countyName,
      detectedAt: sql`coalesce(${bids.detectedAt}, excluded.detected_at)`,
      updatedAt: values.updatedAt
    }
  });

  return true;
}

export async function resolvePendingBids(
  database: NodePgDatabase<typeof dbSchema>,
  now = new Date()
) {
  const lost = await database.execute<{ id: number }>(sql`
    update ${bids}
       set outcome = 'perdido',
           outcome_at = ${now},
           loss_id = ${proposalLosses.id},
           updated_at = ${now}
      from ${proposalLosses}
     where ${bids.outcome} = 'pendente'
       and ${bids.orderId} = ${proposalLosses.orderId}
    returning ${bids.id}
  `);

  const canceled = await database.execute<{ id: number }>(sql`
    update ${bids}
       set outcome = 'cancelado',
           outcome_at = ${now},
           updated_at = ${now}
      from ${quotations}
     where ${bids.outcome} = 'pendente'
       and ${bids.quotationExternalId} = ${quotations.externalId}
       and ${quotations.supplierStatus} = 'CANC'
    returning ${bids.id}
  `);

  // Para detectar "ganho", falta evidência positiva na fonte dizendo que nosso fornecedor venceu.
  // Hoje só há publicação confiável de perda em proposal_losses; sem isso, prazo vencido vira sem_resultado.
  const withoutPublishedResult = await database.execute<{ id: number }>(sql`
    update ${bids}
       set outcome = 'sem_resultado',
           outcome_at = ${now},
           updated_at = ${now}
     where ${bids.outcome} = 'pendente'
       and ${bids.proposalDeadline} is not null
       and ${bids.proposalDeadline} < ${now}
    returning ${bids.id}
  `);

  return lost.rows.length + canceled.rows.length + withoutPublishedResult.rows.length;
}

async function loadLatestPreQuoteSnapshot(
  database: NodePgDatabase<typeof dbSchema>,
  quotationExternalId: string
): Promise<PreQuoteSnapshot | null> {
  const [header] = await database
    .select({
      id: preQuotes.id,
      marginPercent: preQuotes.marginPercent,
      freightCost: preQuotes.freightCost
    })
    .from(preQuotes)
    .where(eq(preQuotes.quotationExternalId, quotationExternalId))
    .orderBy(sql`${preQuotes.updatedAt} desc`, sql`${preQuotes.id} desc`)
    .limit(1);
  if (!header) return null;

  const items = await database
    .select({ quantity: preQuoteItems.quantity, unitCost: preQuoteItems.unitCost })
    .from(preQuoteItems)
    .where(eq(preQuoteItems.preQuoteId, header.id));
  return { ...header, items };
}
