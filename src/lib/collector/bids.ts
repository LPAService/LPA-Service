import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PaginatedResponse, PurchaseOrderListRecord } from "@/lib/collector/client";
import { calcPreQuoteTotals } from "@/lib/prequote/calc";
import { bids, preQuoteItems, preQuotes, proposalLosses, quotations } from "@/lib/db/schema";
import * as dbSchema from "@/lib/db/schema";

type BidQuotationRecord = {
  externalId: string;
  nuBudgetOrder: string | null;
  ourSupplierId?: number | null;
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

export type BidWinSource = {
  listPurchaseOrders(query: {
    idSupplier: number;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResponse<PurchaseOrderListRecord>>;
};

export type ResolvePendingBidsOptions = {
  winSource?: BidWinSource;
  winPageSize?: number;
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
    ourSupplierId: record.ourSupplierId ?? null,
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
      ourSupplierId: values.ourSupplierId,
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
  now = new Date(),
  options: ResolvePendingBidsOptions = {}
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

  const won = options.winSource
    ? await resolveWonBids(database, options.winSource, now, options.winPageSize ?? 100)
    : 0;

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

  return lost.rows.length + canceled.rows.length + won + withoutPublishedResult.rows.length;
}

async function resolveWonBids(
  database: NodePgDatabase<typeof dbSchema>,
  source: BidWinSource,
  now: Date,
  pageSize: number
) {
  const pending = await loadPendingBidsForWinLookup(database);
  if (pending.length === 0) return 0;

  const bySupplier = new Map<number, PendingBidForWinLookup[]>();
  for (const bid of pending) {
    if (bid.ourSupplierId === null) continue;
    const group = bySupplier.get(bid.ourSupplierId) ?? [];
    group.push(bid);
    bySupplier.set(bid.ourSupplierId, group);
  }

  let resolved = 0;
  for (const [supplierId, supplierBids] of bySupplier) {
    const remainingOrderIds = new Set(supplierBids.map((bid) => bid.orderId));
    const publications = new Map<string, PurchaseOrderListRecord>();

    for (let page = 1; ; page += 1) {
      const response = await source.listPurchaseOrders({ idSupplier: supplierId, page, pageSize });
      for (const publication of response.data) {
        if (publication.idSupplier === supplierId && remainingOrderIds.has(publication.orderId)) {
          publications.set(publication.orderId, publication);
          remainingOrderIds.delete(publication.orderId);
        }
      }
      if (
        remainingOrderIds.size === 0 ||
        response.data.length === 0 ||
        page >= response.meta.totalPages
      ) {
        break;
      }
    }

    for (const bid of supplierBids) {
      const publication = publications.get(bid.orderId);
      if (!publication) continue;
      const updated = await database.update(bids).set({
        outcome: "ganho",
        outcomeAt: now,
        winPublicationId: buildWinPublicationReference(publication),
        winPublicationJson: publication,
        updatedAt: now
      }).where(and(eq(bids.id, bid.id), eq(bids.outcome, "pendente"))).returning({ id: bids.id });
      resolved += updated.length;
    }
  }

  return resolved;
}

type PendingBidForWinLookup = {
  id: number;
  orderId: string;
  ourSupplierId: number | null;
};

async function loadPendingBidsForWinLookup(database: NodePgDatabase<typeof dbSchema>) {
  const result = await database.execute<{
    id: number;
    order_id: string;
    our_supplier_id: number | null;
  }>(sql`
    select ${bids.id} as id,
           ${bids.orderId} as order_id,
           coalesce(
             ${bids.ourSupplierId},
             case
               when ${quotations.rawJson} #>> '{listing,idSupplier}' ~ '^[0-9]+$'
               then (${quotations.rawJson} #>> '{listing,idSupplier}')::integer
               else null
             end
           ) as our_supplier_id
      from ${bids}
      left join ${quotations}
        on ${bids.quotationExternalId} = ${quotations.externalId}
     where ${bids.outcome} = 'pendente'
  `);

  return result.rows.map((row) => ({
    id: row.id,
    orderId: row.order_id,
    ourSupplierId: row.our_supplier_id
  }));
}

export function buildWinPublicationReference(publication: PurchaseOrderListRecord) {
  return [
    "purchase-order",
    publication.orderId,
    `subprogram:${publication.idSubprogram}`,
    `school:${publication.idSchool}`,
    `budget:${publication.idBudget}`,
    `supplier:${publication.idSupplier}`
  ].join(":");
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
