import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { collectionRuns, proposalLosses } from "@/lib/db/schema";
import * as dbSchema from "@/lib/db/schema";
import {
  AuthenticatedSgdClient,
  type BudgetProposalRecord,
  type DetailRecord,
  type SummaryRecord
} from "@/lib/collector/quotations";

const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_PROPOSAL_LIMIT = 200;

export type CollectProposalLossesOptions = {
  maxRecords?: number;
  dryRun?: boolean;
  pageSize?: number;
  proposalLimit?: number;
  fetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<void>;
};

export type ProposalLossCollectionResult = {
  runId: number;
  status: "completed" | "failed";
  found: number;
  newCount: number;
  updatedCount: number;
  errorCount: number;
  errors: Array<{ orderId?: string; message: string }>;
};

export type ProposalLossRecord = {
  orderId: string;
  idSubprogram: number;
  idSchool: number;
  idBudget: number;
  schoolName: string;
  countyName: string | null;
  expenseGroup: string;
  proposalDeadline: Date | null;
  ourSupplierId: number;
  ourTotal: number;
  winnerSupplierId: number;
  winnerName: string | null;
  winnerTotal: number | null;
  competitorCount: number;
  ourRank: number | null;
  estimatedValue: number | null;
  rawJson: {
    listing: SummaryRecord;
    detail: DetailRecord | null;
    proposals: BudgetProposalRecord[];
  };
};

export type ProposalLossRepository = {
  startRun(mode: string): Promise<number>;
  finishRun(runId: number, result: ProposalLossCollectionResult): Promise<void>;
  upsertProposalLoss(record: ProposalLossRecord): Promise<"new" | "updated">;
};

export async function collectProposalLosses(options: CollectProposalLossesOptions = {}) {
  const { db } = await import("@/lib/db");
  const login = process.env.SGD_LOGIN?.trim();
  const password = process.env.SGD_PASSWORD?.trim();
  if (!login || !password) throw new Error("SGD_LOGIN/SGD_PASSWORD ausente");

  const client = new AuthenticatedSgdClient({
    login,
    password,
    fetchFn: options.fetchFn,
    sleepFn: options.sleepFn
  });
  await client.login();
  return collectProposalLossesWithClient(client, new DrizzleProposalLossRepository(db), options);
}

export async function collectProposalLossesWithClient(
  client: Pick<AuthenticatedSgdClient, "listRejectedQuotations" | "listBudgetProposals" | "getBudgetDetail">,
  repository: ProposalLossRepository,
  options: CollectProposalLossesOptions = {}
): Promise<ProposalLossCollectionResult> {
  const runId = await repository.startRun(options.dryRun ? "proposal_losses_dry_run" : "proposal_losses");
  const result: ProposalLossCollectionResult = {
    runId,
    status: "completed",
    found: 0,
    newCount: 0,
    updatedCount: 0,
    errorCount: 0,
    errors: []
  };
  let processed = 0;

  try {
    for (let page = 1; ; page += 1) {
      const listing = await client.listRejectedQuotations(page, options.pageSize ?? DEFAULT_PAGE_SIZE);
      if (listing.data.length === 0) break;

      for (const record of listing.data) {
        if (options.maxRecords && processed >= options.maxRecords) break;
        const orderId = parseOrderId(record.nuBudgetOrder);
        result.found += 1;
        processed += 1;

        try {
          const [detail, proposals] = await Promise.all([
            client.getBudgetDetail(record).catch(() => null),
            client.listBudgetProposals(record, options.proposalLimit ?? DEFAULT_PROPOSAL_LIMIT)
          ]);
          const loss = buildProposalLossRecord(record, detail, proposals);
          if (!options.dryRun) {
            const upsert = await repository.upsertProposalLoss(loss);
            if (upsert === "new") result.newCount += 1;
            else result.updatedCount += 1;
          }
        } catch (error) {
          result.errorCount += 1;
          result.errors.push({ orderId: orderId ?? undefined, message: errorMessage(error) });
        }
      }

      if ((options.maxRecords && processed >= options.maxRecords) || page >= (listing.meta?.totalPages ?? page)) break;
    }

    await repository.finishRun(runId, result);
    return result;
  } catch (error) {
    result.status = "failed";
    result.errorCount += 1;
    result.errors.push({ message: errorMessage(error) });
    await repository.finishRun(runId, result);
    throw error;
  }
}

export function buildProposalLossRecord(
  listing: SummaryRecord,
  detail: DetailRecord | null,
  proposals: BudgetProposalRecord[]
): ProposalLossRecord {
  const orderId = parseOrderId(listing.nuBudgetOrder);
  if (!orderId) throw new Error("Perda sem nuBudgetOrder");

  const ourSupplierId = parseInteger(listing.idSupplier);
  if (ourSupplierId === null) throw new Error(`Perda ${orderId} sem idSupplier do cliente`);

  const ourProposal = proposals.find((proposal) => parseInteger(proposal.idSupplier) === ourSupplierId);
  const ourTotal = parseMoney(ourProposal?.totalPropose);
  if (ourTotal === null) throw new Error(`Perda ${orderId} sem totalPropose do cliente`);

  const winnerSupplierId =
    proposals.map((proposal) => parseInteger(proposal.idSupplierWinner)).find((id) => id !== null) ??
    parseInteger(detail?.idSupplierProposalWinner);
  if (winnerSupplierId === null) throw new Error(`Perda ${orderId} sem idSupplierWinner`);

  const winnerProposal = proposals.find((proposal) => parseInteger(proposal.idSupplier) === winnerSupplierId);
  const winnerTotal = parseMoney(winnerProposal?.totalPropose);

  return {
    orderId,
    idSubprogram: listing.idSubprogram,
    idSchool: listing.idSchool,
    idBudget: listing.idBudget,
    schoolName: detail?.schoolName ?? listing.schoolName ?? "Não informado",
    countyName: detail?.countyName ?? listing.countyName ?? null,
    expenseGroup: detail?.expenseGroupDescription ?? listing.expenseGroupDescription ?? "Não informado",
    proposalDeadline: parseDate(detail?.dtProposalSubmission ?? listing.dtProposalSubmission),
    ourSupplierId,
    ourTotal,
    winnerSupplierId,
    winnerName: winnerProposal?.txFantasyName?.trim() || null,
    winnerTotal,
    competitorCount: proposals.length,
    ourRank: calculatePriceRank(proposals, ourSupplierId),
    estimatedValue: parseMoney(detail?.estimatedValue),
    rawJson: { listing, detail, proposals }
  };
}

export function calculatePriceRank(proposals: BudgetProposalRecord[], supplierId: number) {
  const ourTotal = parseMoney(
    proposals.find((proposal) => parseInteger(proposal.idSupplier) === supplierId)?.totalPropose
  );
  if (ourTotal === null) return null;

  const cheaperCount = proposals.filter((proposal) => {
    const total = parseMoney(proposal.totalPropose);
    return total !== null && total < ourTotal;
  }).length;
  return cheaperCount + 1;
}

export function calculateLossGapPercent(ourTotal: number | null, winnerTotal: number | null) {
  if (ourTotal === null || winnerTotal === null || winnerTotal <= 0) return null;
  return ((ourTotal - winnerTotal) / winnerTotal) * 100;
}

export class DrizzleProposalLossRepository implements ProposalLossRepository {
  constructor(private readonly database: NodePgDatabase<typeof dbSchema>) {}

  async startRun(mode: string) {
    const [run] = await this.database.insert(collectionRuns).values({ mode }).returning({ id: collectionRuns.id });
    return run.id;
  }

  async finishRun(runId: number, result: ProposalLossCollectionResult) {
    await this.database.update(collectionRuns).set({
      status: result.status,
      finishedAt: new Date(),
      found: result.found,
      newCount: result.newCount,
      updatedCount: result.updatedCount,
      errorCount: result.errorCount,
      errors: result.errors
    }).where(eq(collectionRuns.id, runId));
  }

  async upsertProposalLoss(record: ProposalLossRecord) {
    const existing = await this.database
      .select({ id: proposalLosses.id })
      .from(proposalLosses)
      .where(eq(proposalLosses.orderId, record.orderId))
      .limit(1);
    const values = {
      orderId: record.orderId,
      idSubprogram: record.idSubprogram,
      idSchool: record.idSchool,
      idBudget: record.idBudget,
      schoolName: record.schoolName,
      countyName: record.countyName,
      expenseGroup: record.expenseGroup,
      proposalDeadline: record.proposalDeadline,
      ourSupplierId: record.ourSupplierId,
      ourTotal: record.ourTotal,
      winnerSupplierId: record.winnerSupplierId,
      winnerName: record.winnerName,
      winnerTotal: record.winnerTotal,
      competitorCount: record.competitorCount,
      ourRank: record.ourRank,
      estimatedValue: record.estimatedValue,
      rawJson: record.rawJson,
      updatedAt: new Date()
    };

    await this.database.insert(proposalLosses).values(values).onConflictDoUpdate({
      target: proposalLosses.orderId,
      set: values
    });

    return existing.length === 0 ? "new" : "updated";
  }
}

function parseOrderId(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function parseDate(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : null;
}

function parseInteger(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function parseMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value).trim();
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
