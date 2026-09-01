import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import categoriesRaw from "@/lib/classification/categories.json";
import { classifyOpportunity } from "@/lib/parsing/normalize";
import { summarize } from "@/lib/parsing/summarize";
import { collectionRuns, quotationItems, quotations } from "@/lib/db/schema";
import * as dbSchema from "@/lib/db/schema";
import rmbhCounties from "@/lib/collector/rmbh-counties.json";
import { analyzeProposalBlock } from "@/lib/collector/proposal-block";
import { extractReferencePrice } from "@/lib/parsing/reference-price";

const API_BASE = "https://api.caixaescolar.educacao.mg.gov.br";
const PORTAL_BASE = "https://caixaescolar.educacao.mg.gov.br";
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_ITEM_PAGE_SIZE = 50;
const TIER1_ORDER = ["Ibirité", "Contagem", "Betim", "Belo Horizonte"];
const CATEGORIES_BY_SLUG = new Map(
  (categoriesRaw as Array<{ slug: string; name: string }>).map((category) => [category.slug, category])
);

export type QuotationCounty = { idCounty: number; name: string };

export type CollectQuotationsOptions = {
  counties?: QuotationCounty[];
  maxRecords?: number;
  dryRun?: boolean;
  pageSize?: number;
  itemPageSize?: number;
  fetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<void>;
};

export type QuotationCollectionResult = {
  runId: number;
  status: "completed" | "failed";
  found: number;
  newCount: number;
  updatedCount: number;
  errorCount: number;
  errors: Array<{ externalId?: string; message: string }>;
};

export type SummaryRecord = {
  idSubprogram: number;
  idSchool: number;
  idBudget: number;
  idSupplier?: number | null;
  idCounty?: number | null;
  countyName?: string | null;
  schoolName?: string | null;
  expenseGroupDescription?: string | null;
  expenseGroupRootId?: number | null;
  dtProposalSubmission?: string | null;
  dtServiceDelivery?: string | null;
  budgetStatus?: string | null;
  supplierStatus?: string | null;
  nuBudgetOrder?: string | number | null;
  year?: string | number | null;
};

export type DetailRecord = {
  schoolName?: string | null;
  countyName?: string | null;
  subprogramName?: string | null;
  dtProposalSubmission?: string | null;
  dtDelivery?: string | null;
  expenseGroupDescription?: string | null;
  initiativeDescription?: string | null;
  estimatedValue?: number | string | null;
  idSupplierProposalWinner?: number | null;
  txAnalystJustification?: string | null;
  status?: string | null;
};

export type BudgetProposalRecord = {
  idSupplier?: number | null;
  idSupplierWinner?: number | null;
  txFantasyName?: string | null;
  totalPropose?: number | string | null;
  personType?: string | null;
};

type ItemRecord = {
  nuItemOrder?: number | null;
  txDescription?: string | null;
  txBudgetItemType?: string | null;
  txBudgetItemUnit?: string | null;
  coBudgetItemUnit?: string | null;
  nuQuantity?: number | string | null;
  nuValueByItem?: number | string | null;
  nuReferralValue?: number | string | null;
  txExpenseCategory?: string | null;
};

type Paginated<T> = {
  data: T[];
  meta?: { totalItems?: number; totalPages?: number; currentPage?: number };
};

export class AuthenticatedSgdClient {
  private cookie = "";
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly options: {
      login: string;
      password: string;
      baseUrl?: string;
      fetchFn?: typeof fetch;
      sleepFn?: (ms: number) => Promise<void>;
    }
  ) {}

  async login() {
    const response = await this.request("/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: PORTAL_BASE
      },
      body: JSON.stringify({
        txCpfCnpj: this.options.login,
        txPassword: this.options.password
      })
    }, false);

    if (response.status !== 201) {
      throw new Error(`SGD login returned ${response.status}`);
    }

    const setCookie = response.headers.get("set-cookie");
    if (!setCookie) throw new Error("SGD login sem cookie de sessão");
    this.cookie = setCookie.split(",").map((part) => part.split(";")[0]).join("; ");
  }

  async listOpenQuotations(county: QuotationCounty, page: number, limit = DEFAULT_PAGE_SIZE) {
    return this.getJson<Paginated<SummaryRecord>>("/budget-proposal/summary-by-supplier-profile", {
      "filter.status": "$eq:NAEN",
      "filter.idCounty": `$eq:${county.idCounty}`,
      page,
      limit
    });
  }

  async listRejectedQuotations(page: number, limit = DEFAULT_PAGE_SIZE) {
    return this.getJson<Paginated<SummaryRecord>>("/budget-proposal/summary-by-supplier-profile", {
      "filter.supplierStatus": "$eq:RECU",
      page,
      limit
    });
  }

  async getBudgetDetail(record: SummaryRecord) {
    return this.getJson<DetailRecord>(`/budget/by-subprogram/${record.idSubprogram}/by-school/${record.idSchool}/by-budget/${record.idBudget}`);
  }

  async listBudgetItems(record: SummaryRecord, page: number, limit = DEFAULT_ITEM_PAGE_SIZE) {
    return this.getJson<Paginated<ItemRecord>>(`/budget-item/by-subprogram/${record.idSubprogram}/by-school/${record.idSchool}/by-budget/${record.idBudget}`, {
      page,
      limit
    });
  }

  async listBudgetProposals(record: SummaryRecord, limit = 200) {
    const response = await this.getJson<BudgetProposalRecord[] | Paginated<BudgetProposalRecord>>(`/budget-proposal/by-subprogram/${record.idSubprogram}/by-school/${record.idSchool}/by-budget/${record.idBudget}`, {
      limit
    });
    return Array.isArray(response) ? response : response.data;
  }

  private async getJson<T>(path: string, params: Record<string, unknown> = {}) {
    const url = new URL(path, this.options.baseUrl ?? API_BASE);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await this.waitTurn(attempt === 0 ? 250 : 750 * attempt);
      const response = await this.request(url.pathname + url.search, { method: "GET" }, true);
      if (response.ok) return (await response.json()) as T;
      const body = await response.text();
      if (response.status === 401 && attempt === 0) {
        lastError = new Error("SGD API returned 401: sessão renovada");
        await this.login();
        continue;
      }
      lastError = new Error(`SGD API returned ${response.status}: ${body.slice(0, 240)}`);
      if (response.status !== 429 && response.status < 500) break;
      await (this.options.sleepFn ?? delay)(1_000 * (attempt + 1));
    }
    throw lastError;
  }

  private async request(path: string, init: RequestInit, authenticated: boolean) {
    const headers = new Headers(init.headers);
    headers.set("user-agent", "lpa-leo-open-quotations/0.1");
    if (authenticated) {
      if (!this.cookie) throw new Error("SGD client sem sessão");
      headers.set("cookie", this.cookie);
    }
    return (this.options.fetchFn ?? fetch)(new URL(path, this.options.baseUrl ?? API_BASE), {
      ...init,
      headers
    });
  }

  private async waitTurn(ms: number) {
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    await (this.options.sleepFn ?? delay)(ms);
    release();
  }
}

export async function collectOpenQuotations(options: CollectQuotationsOptions = {}) {
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
  return collectOpenQuotationsWithClient(client, new DrizzleQuotationRepository(db), options);
}

export async function collectOpenQuotationsWithClient(
  client: Pick<AuthenticatedSgdClient, "listOpenQuotations" | "getBudgetDetail" | "listBudgetItems">,
  repository: QuotationRepository,
  options: CollectQuotationsOptions = {}
): Promise<QuotationCollectionResult> {
  const runId = await repository.startRun(options.dryRun ? "open_quotations_dry_run" : "open_quotations");
  const result: QuotationCollectionResult = { runId, status: "completed", found: 0, newCount: 0, updatedCount: 0, errorCount: 0, errors: [] };
  const counties = options.counties ?? defaultTier1Counties();
  let processed = 0;

  try {
    for (const county of counties) {
      try {
        for (let page = 1; ; page += 1) {
          const listing = await client.listOpenQuotations(county, page, options.pageSize ?? DEFAULT_PAGE_SIZE);
          if (listing.data.length === 0) break;
          for (const record of listing.data) {
            if (options.maxRecords && processed >= options.maxRecords) break;
            const externalId = buildQuotationExternalId(record);
            result.found += 1;
            processed += 1;
            try {
              const detail = await client.getBudgetDetail(record);
              const items = await fetchQuotationItems(client, record, options.itemPageSize ?? DEFAULT_ITEM_PAGE_SIZE);
              const quotation = buildQuotationRecord(record, detail, items);
              if (!options.dryRun) {
                const upsert = await repository.upsertQuotation(quotation);
                if (upsert === "new") result.newCount += 1;
                else result.updatedCount += 1;
              }
            } catch (error) {
              result.errorCount += 1;
              result.errors.push({ externalId, message: errorMessage(error) });
            }
          }
          if ((options.maxRecords && processed >= options.maxRecords) || page >= (listing.meta?.totalPages ?? page)) break;
        }
      } catch (error) {
        result.errorCount += 1;
        result.errors.push({ message: `[${county.name}] ${errorMessage(error)}` });
      }
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

export function defaultTier1Counties() {
  return [...rmbhCounties.collected].sort((left, right) => {
    const leftIndex = TIER1_ORDER.indexOf(left.name);
    const rightIndex = TIER1_ORDER.indexOf(right.name);
    return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
  });
}

export function selectCounties(input?: string) {
  if (!input) return defaultTier1Counties();
  const tokens = input.split(",").map((token) => token.trim()).filter(Boolean);
  const all = [...rmbhCounties.counties, ...rmbhCounties.priority];
  return tokens.map((token) => {
    const byId = all.find((county) => String(county.idCounty) === token);
    const byName = all.find((county) => normalize(county.name) === normalize(token));
    const county = byId ?? byName;
    if (!county) throw new Error(`Município desconhecido: ${token}`);
    return { idCounty: county.idCounty, name: county.name };
  });
}

export function buildQuotationExternalId(record: Pick<SummaryRecord, "idSubprogram" | "idSchool" | "idBudget">) {
  return `${record.idSubprogram}-${record.idSchool}-${record.idBudget}`;
}

export function buildProposalUrl(record: Pick<SummaryRecord, "idSubprogram" | "idSchool" | "idBudget">) {
  return `${PORTAL_BASE}/compras/orcamento/subprograma/${record.idSubprogram}/escola/${record.idSchool}/detalhe-orcamento/${record.idBudget}`;
}

export function getQuotationStatus(proposalDeadline: Date | string | null, collectedAt: Date | string | null, now = new Date()) {
  const deadline = parseDate(proposalDeadline);
  if (deadline && deadline.getTime() < now.getTime()) return "Encerrada";
  const collected = parseDate(collectedAt);
  if (collected && now.getTime() - collected.getTime() <= 24 * 60 * 60 * 1000) return "Nova";
  if (deadline && deadline.getTime() - now.getTime() <= 3 * 24 * 60 * 60 * 1000) return "Encerrando em breve";
  return "Aberta";
}

async function fetchQuotationItems(
  client: Pick<AuthenticatedSgdClient, "listBudgetItems">,
  record: SummaryRecord,
  itemPageSize: number
) {
  const all: ItemRecord[] = [];
  for (let page = 1; ; page += 1) {
    const response = await client.listBudgetItems(record, page, itemPageSize);
    all.push(...response.data);
    if (response.data.length === 0 || page >= (response.meta?.totalPages ?? page)) break;
  }
  return all;
}

type QuotationRecord = ReturnType<typeof buildQuotationRecord>;

export function buildQuotationRecord(listing: SummaryRecord, detail: DetailRecord, sourceItems: ItemRecord[]) {
  const mappedItems = sourceItems.map(mapQuotationItem);
  const expenseGroup = detail.expenseGroupDescription ?? listing.expenseGroupDescription ?? "Não informado";
  const classification = classifyOpportunity({
    expenseGroup,
    initiativeDescription: detail.initiativeDescription ?? null,
    itemNames: mappedItems.map((item) => item.name)
  });
  const category = (categoriesRaw as Array<{ slug: string; name: string }>).find(
    (candidate) => candidate.slug === (classification.needsFallback ? "outros" : classification.categoryId)
  ) ?? { slug: "outros", name: "Outros" };
  const summary = summarize({
    category: { slug: category.slug, name: category.name, confidence: classification.confidence, needsFallback: classification.needsFallback },
    initiativeDescription: detail.initiativeDescription ?? null,
    expenseGroup,
    items: mappedItems.map((item) => ({
      order: item.itemOrder,
      name: item.name,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      unitValue: item.referenceValue,
      totalValue: item.referenceValue === null ? null : item.referenceValue * item.quantity,
      isPermanent: false,
      expenseCategory: ""
    }))
  });
  const itemTotals = mappedItems.filter((item) => item.referenceValue !== null);
  const proposalBlock = analyzeProposalBlock(mappedItems);
  const totalReferenceValue =
    parseNumber(detail.estimatedValue) ??
    (itemTotals.length === 0 ? null : itemTotals.reduce((total, item) => total + ((item.referenceValue ?? 0) * item.quantity), 0));

  return {
    externalId: buildQuotationExternalId(listing),
    nuBudgetOrder: listing.nuBudgetOrder === null || listing.nuBudgetOrder === undefined ? null : String(listing.nuBudgetOrder),
    idSubprogram: listing.idSubprogram,
    idSchool: listing.idSchool,
    idBudget: listing.idBudget,
    idCounty: listing.idCounty ?? null,
    countyName: detail.countyName ?? listing.countyName ?? null,
    schoolName: detail.schoolName ?? listing.schoolName ?? "Não informado",
    expenseGroup,
    categorySlug: category.slug,
    headline: summary.headline || category.name,
    summary: summary.summary || "Resumo não informado.",
    topItems: summary.topItems,
    proposalDeadline: parseDate(detail.dtProposalSubmission ?? listing.dtProposalSubmission),
    deliveryDate: parseDate(detail.dtDelivery ?? listing.dtServiceDelivery),
    itemCount: mappedItems.length,
    totalReferenceValue,
    budgetStatus: listing.budgetStatus ?? detail.status ?? null,
    supplierStatus: listing.supplierStatus ?? null,
    proposalUrl: buildProposalUrl(listing),
    proposalBlocked: proposalBlock.blocked,
    proposalBlockedReason: proposalBlock.reason,
    proposalBlockedItemCount: proposalBlock.blockedItemCount,
    proposalSuspect: proposalBlock.suspect,
    proposalSuspectItemCount: proposalBlock.suspectItemCount,
    rawJson: { listing, detail, items: sourceItems },
    items: mappedItems
  };
}

function mapQuotationItem(item: ItemRecord) {
  const description = item.txDescription ?? "Não informado";
  return {
    itemOrder: item.nuItemOrder ?? 0,
    name: item.txBudgetItemType ?? item.txDescription ?? "Não informado",
    description,
    unit: item.txBudgetItemUnit ?? item.coBudgetItemUnit ?? "Não informado",
    quantity: parseNumber(item.nuQuantity) ?? 0,
    referenceValue: parseNumber(item.nuReferralValue) ?? parseNumber(item.nuValueByItem) ?? extractReferencePrice(description),
    rawJson: item
  };
}

export type QuotationRepository = {
  startRun(mode: string): Promise<number>;
  finishRun(runId: number, result: QuotationCollectionResult): Promise<void>;
  upsertQuotation(record: QuotationRecord): Promise<"new" | "updated">;
};

export class DrizzleQuotationRepository implements QuotationRepository {
  constructor(private readonly database: NodePgDatabase<typeof dbSchema>) {}

  async startRun(mode: string) {
    const [run] = await this.database.insert(collectionRuns).values({ mode }).returning({ id: collectionRuns.id });
    return run.id;
  }

  async finishRun(runId: number, result: QuotationCollectionResult) {
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

  async upsertQuotation(record: QuotationRecord) {
    const categoryId = await this.categoryId(record.categorySlug);
    const existing = await this.database.select({ id: quotations.id }).from(quotations).where(eq(quotations.externalId, record.externalId)).limit(1);
    const values = {
      externalId: record.externalId,
      nuBudgetOrder: record.nuBudgetOrder,
      idSubprogram: record.idSubprogram,
      idSchool: record.idSchool,
      idBudget: record.idBudget,
      idCounty: record.idCounty,
      countyName: record.countyName,
      schoolName: record.schoolName,
      expenseGroup: record.expenseGroup,
      categoryId,
      headline: record.headline,
      summary: record.summary,
      topItems: record.topItems,
      proposalDeadline: record.proposalDeadline,
      deliveryDate: record.deliveryDate,
      itemCount: record.itemCount,
      totalReferenceValue: record.totalReferenceValue,
      budgetStatus: record.budgetStatus,
      supplierStatus: record.supplierStatus,
      proposalUrl: record.proposalUrl,
      proposalBlocked: record.proposalBlocked,
      proposalBlockedReason: record.proposalBlockedReason,
      proposalBlockedItemCount: record.proposalBlockedItemCount,
      proposalSuspect: record.proposalSuspect,
      proposalSuspectItemCount: record.proposalSuspectItemCount,
      rawJson: record.rawJson,
      updatedAt: new Date()
    };
    const [row] = await this.database.insert(quotations).values(values).onConflictDoUpdate({
      target: quotations.externalId,
      set: values
    }).returning({ id: quotations.id });

    await this.database.delete(quotationItems).where(eq(quotationItems.quotationId, row.id));
    if (record.items.length > 0) {
      await this.database.insert(quotationItems).values(record.items.map((item) => ({
        quotationId: row.id,
        itemOrder: item.itemOrder,
        name: item.name,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        referenceValue: item.referenceValue,
        rawJson: item.rawJson
      })));
    }
    return existing.length === 0 ? "new" : "updated";
  }

  private async categoryId(slug: string) {
    const category = CATEGORIES_BY_SLUG.get(slug);
    if (!category) return null;

    const result = await this.database.execute<{ id: number }>(sql`
      insert into categories (slug, name, active)
      values (${category.slug}, ${category.name}, true)
      on conflict (slug) do update set
        name = excluded.name,
        active = true
      returning id
    `);
    return result.rows[0]?.id ?? null;
  }
}

function parseDate(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : null;
}

function parseNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
