import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExternalId,
  collectOpportunities,
  collectSchoolDimension,
  refreshStale,
  type CollectionRunResult,
  type CollectorClient,
  type CollectorRepository,
  type OpportunityRecord,
  type SchoolRecord
} from "@/lib/collector/collect";
import type {
  PaginatedResponse,
  PortalFilters,
  PortalFiltersQuery,
  PurchaseOrderAttachment,
  PurchaseOrderDetail,
  PurchaseOrderItem,
  PurchaseOrderItemsQuery,
  PurchaseOrderKey,
  PurchaseOrderListRecord,
  PurchaseOrdersQuery
} from "@/lib/collector/client";

const fixturesRoot = resolve(process.cwd(), "../../research/portal/fixtures");

function readFixture<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(fixturesRoot, name), "utf8")) as T;
}

const purchasePage1 =
  readFixture<PaginatedResponse<PurchaseOrderListRecord>>("purchase_orders_page1.json");
const purchasePage2 =
  readFixture<PaginatedResponse<PurchaseOrderListRecord>>("purchase_orders_page2.json");
const detail1 = readFixture<PurchaseOrderDetail>("detail_1.json");
const detail2 = readFixture<PurchaseOrderDetail>("detail_2.json");
const items1 = readFixture<PaginatedResponse<PurchaseOrderItem>>("items_1.json");
const items3 = readFixture<PaginatedResponse<PurchaseOrderItem>>("items_3.json");
const attachmentMetadata = readFixture<{
  data: PurchaseOrderAttachment[];
}>("attachment_metadata.json");

describe("collector", () => {
  it("pagina listagem e itens, e UPSERT não duplica em modo full", async () => {
    const first = purchasePage1.data[0]!;
    const second = purchasePage2.data[0]!;
    const client = new FakeClient({
      purchasePages: [
        page([first], 1, 2),
        page([second], 2, 2)
      ],
      details: {
        [buildExternalId(first)]: detail1,
        [buildExternalId(second)]: detail2
      },
      itemPages: {
        [buildExternalId(first)]: [
          page([items3.data[0]!], 1, 2),
          page([items3.data[1]!], 2, 2)
        ],
        [buildExternalId(second)]: [items1]
      }
    });
    const repository = new FakeRepository([schoolFor(first), schoolFor(second)]);

    const firstRun = await collectOpportunities(client, repository, {
      mode: "full",
      refreshSchools: false,
      pageSize: 1,
      itemPageSize: 1
    });
    const secondRun = await collectOpportunities(client, repository, {
      mode: "full",
      refreshSchools: false,
      pageSize: 1,
      itemPageSize: 1
    });

    expect(firstRun).toMatchObject({ found: 2, newCount: 2, updatedCount: 0, errorCount: 0 });
    expect(secondRun).toMatchObject({ found: 2, newCount: 0, updatedCount: 2, errorCount: 0 });
    expect(repository.opportunities.size).toBe(2);
    expect(repository.opportunities.get(buildExternalId(first))?.items).toHaveLength(2);
    expect(client.purchasePageCalls).toEqual([1, 2, 1, 2]);
    expect(client.itemPageCalls.filter((call) => call.externalId === buildExternalId(first))).toEqual([
      { externalId: buildExternalId(first), page: 1 },
      { externalId: buildExternalId(first), page: 2 },
      { externalId: buildExternalId(first), page: 1 },
      { externalId: buildExternalId(first), page: 2 }
    ]);
  });

  it("preserva campos nulos, valor de item nulo e anexo com url vazia", async () => {
    const source = {
      ...purchasePage1.data[0]!,
      accountabilityStatus: null,
      purchaseDate: null,
      idSupplier: null
    };
    const detail: PurchaseOrderDetail = {
      ...detail1,
      purchaseOrderStatus: null,
      dtProposalSubmission: null,
      dtDelivery: null,
      supplierName: null,
      supplierDocument: null,
      initiativeDescription: null
    };
    const item = {
      ...items1.data[0]!,
      nuValueByItem: null
    };
    const client = new FakeClient({
      purchasePages: [page([source], 1, 1)],
      details: { [buildExternalId(source)]: detail },
      itemPages: { [buildExternalId(source)]: [page([item], 1, 1)] },
      images: { [buildExternalId(source)]: attachmentMetadata.data }
    });
    const repository = new FakeRepository([schoolFor(source)]);

    await collectOpportunities(client, repository, {
      mode: "full",
      refreshSchools: false
    });

    const saved = repository.opportunities.get(buildExternalId(source));
    expect(saved).toMatchObject({
      accountabilityStatus: null,
      purchaseDate: null,
      proposalDate: null,
      deliveryDate: null,
      purchaseOrderStatus: null,
      supplierName: null,
      supplierDocument: null,
      initiativeDescription: null,
      idSupplier: null,
      totalValue: null
    });
    expect(saved?.items[0]).toMatchObject({ unitValue: null, totalValue: null });
    expect(saved?.attachments[0]).toMatchObject({ url: null });
  });

  it("registra erro 5xx de um processo e continua próximos registros", async () => {
    const failing = purchasePage1.data[0]!;
    const succeeding = purchasePage1.data[1]!;
    const client = new FakeClient({
      purchasePages: [page([failing, succeeding], 1, 1)],
      details: { [buildExternalId(succeeding)]: detail2 },
      detailErrors: { [buildExternalId(failing)]: new Error("Caixa Escolar API returned 500") },
      itemPages: { [buildExternalId(succeeding)]: [items1] }
    });
    const repository = new FakeRepository([schoolFor(failing), schoolFor(succeeding)]);

    const result = await collectOpportunities(client, repository, {
      mode: "full",
      refreshSchools: false
    });

    expect(result.status).toBe("completed");
    expect(result).toMatchObject({ found: 2, newCount: 1, errorCount: 1 });
    expect(result.errors[0]).toEqual({
      externalId: buildExternalId(failing),
      message: "Caixa Escolar API returned 500"
    });
    expect(repository.opportunities.has(buildExternalId(succeeding))).toBe(true);
  });

  it("resposta vazia não busca detalhe nem grava oportunidades", async () => {
    const client = new FakeClient({
      purchasePages: [page([], 1, 0)]
    });
    const repository = new FakeRepository();

    const result = await collectOpportunities(client, repository, {
      mode: "full",
      refreshSchools: false
    });

    expect(result).toMatchObject({ found: 0, newCount: 0, updatedCount: 0, errorCount: 0 });
    expect(client.detailCalls).toBe(0);
    expect(repository.opportunities.size).toBe(0);
  });

  it("monta dimensão schools usando só consulta por county, sem refino regional", async () => {
    const client = new FakeClient({
      filters: {
        base: {
          counties: [
            { idCounty: 1, txCounty: "Cidade A" },
            { idCounty: 2, txCounty: "Cidade B" }
          ]
        },
        "county:1": {
          regionals: Array.from({ length: 48 }, (_, index) => ({
            idNetwork: index + 1,
            txName: `SRE/${index + 1}`
          })),
          schools: [{ idSchool: 100, txName: "ESCOLA A" }]
        },
        "county:2": {
          regionals: Array.from({ length: 48 }, (_, index) => ({
            idNetwork: index + 1,
            txName: `SRE/${index + 1}`
          })),
          schools: [{ idSchool: 200, txName: "ESCOLA B" }]
        }
      }
    });
    const repository = new FakeRepository();

    const count = await collectSchoolDimension(client, repository);

    expect(count).toBe(2);
    expect(repository.schools.get(100)).toMatchObject({ city: "Cidade A", regional: null });
    expect(repository.schools.get(200)).toMatchObject({ city: "Cidade B", regional: null });
    expect(client.filterCalls).toEqual(["base", "county:1", "county:2"]);
  });

  it("incremental atualiza conhecidos e para só após 3 páginas sem novo", async () => {
    const knownRecords = purchasePage1.data.slice(0, 3);
    const newRecord = purchasePage1.data[3]!;
    const client = new FakeClient({
      purchasePages: [
        page([knownRecords[0]!], 1, 4),
        page([knownRecords[1]!], 2, 4),
        page([knownRecords[2]!], 3, 4),
        page([newRecord], 4, 4)
      ],
      details: Object.fromEntries(
        knownRecords.map((record) => [buildExternalId(record), detail1])
      ),
      itemPages: Object.fromEntries(
        knownRecords.map((record) => [buildExternalId(record), [items1]])
      )
    });
    const repository = new FakeRepository(
      knownRecords.map(schoolFor),
      knownRecords.map(buildExternalId)
    );

    const result = await collectOpportunities(client, repository, {
      mode: "incremental",
      refreshSchools: false,
      pageSize: 1
    });

    expect(result).toMatchObject({ found: 3, newCount: 0, updatedCount: 3, errorCount: 0 });
    expect(client.purchasePageCalls).toEqual([1, 2, 3]);
    expect(client.detailCalls).toBe(3);
    expect(repository.opportunities.has(buildExternalId(newRecord))).toBe(false);
  });

  it("refreshStale re-coleta registros vencidos pelo TTL", async () => {
    const source = purchasePage1.data[0]!;
    const client = new FakeClient({
      details: { [buildExternalId(source)]: detail1 },
      itemPages: { [buildExternalId(source)]: [items1] },
      images: { [buildExternalId(source)]: attachmentMetadata.data }
    });
    const repository = new FakeRepository([schoolFor(source)], [buildExternalId(source)]);
    repository.staleListings = [source];

    const result = await refreshStale(client, repository);

    expect(result).toMatchObject({ found: 1, newCount: 0, updatedCount: 1, errorCount: 0 });
    expect(repository.opportunities.get(buildExternalId(source))?.attachments).toHaveLength(2);
  });
});

function page<T>(data: T[], pageNumber: number, totalPages: number): PaginatedResponse<T> {
  return {
    data,
    meta: {
      page: pageNumber,
      pageSize: data.length,
      total: data.length * Math.max(totalPages, 1),
      totalPages
    }
  };
}

function schoolFor(record: PurchaseOrderListRecord): SchoolRecord {
  return {
    idSchool: record.idSchool,
    name: record.school,
    idCounty: record.idSchool,
    city: `Cidade ${record.idSchool}`,
    regional: `Regional ${record.idSchool}`,
    rawJson: {}
  };
}

class FakeClient implements CollectorClient {
  purchasePageCalls: number[] = [];
  itemPageCalls: { externalId: string; page: number }[] = [];
  filterCalls: string[] = [];
  detailCalls = 0;
  private readonly purchasePages: PaginatedResponse<PurchaseOrderListRecord>[];
  private readonly details: Record<string, PurchaseOrderDetail>;
  private readonly detailErrors: Record<string, Error>;
  private readonly itemPages: Record<string, PaginatedResponse<PurchaseOrderItem>[]>;
  private readonly images: Record<string, PurchaseOrderAttachment[]>;
  private readonly filters: Record<string, PortalFilters>;

  constructor(options: {
    purchasePages?: PaginatedResponse<PurchaseOrderListRecord>[];
    details?: Record<string, PurchaseOrderDetail>;
    detailErrors?: Record<string, Error>;
    itemPages?: Record<string, PaginatedResponse<PurchaseOrderItem>[]>;
    images?: Record<string, PurchaseOrderAttachment[]>;
    filters?: Record<string, PortalFilters>;
  } = {}) {
    this.purchasePages = options.purchasePages ?? [page([], 1, 0)];
    this.details = options.details ?? {};
    this.detailErrors = options.detailErrors ?? {};
    this.itemPages = options.itemPages ?? {};
    this.images = options.images ?? {};
    this.filters = options.filters ?? {};
  }

  async listPurchaseOrders(query: PurchaseOrdersQuery) {
    const pageNumber = query.page ?? 1;
    this.purchasePageCalls.push(pageNumber);
    return this.purchasePages[pageNumber - 1] ?? page([], pageNumber, 0);
  }

  async getPurchaseOrderDetail(key: PurchaseOrderKey) {
    this.detailCalls += 1;
    const externalId = buildExternalId(key);
    const error = this.detailErrors[externalId];
    if (error) {
      throw error;
    }
    return this.details[externalId] ?? detail1;
  }

  async listPurchaseOrderItems(query: PurchaseOrderItemsQuery) {
    const externalId = buildExternalId(query);
    const pageNumber = query.page ?? 1;
    this.itemPageCalls.push({ externalId, page: pageNumber });
    return this.itemPages[externalId]?.[pageNumber - 1] ?? page([], pageNumber, 0);
  }

  async getPurchaseOrderImages(key: PurchaseOrderKey) {
    return this.images[buildExternalId(key)] ?? [];
  }

  async getPortalFilters(query: PortalFiltersQuery = {}) {
    if (query.county && query.regional) {
      this.filterCalls.push(`county:${query.county}:regional:${query.regional}`);
      return this.filters[`county:${query.county}:regional:${query.regional}`] ?? {};
    }
    if (query.county) {
      this.filterCalls.push(`county:${query.county}`);
      return this.filters[`county:${query.county}`] ?? {};
    }
    this.filterCalls.push("base");
    return this.filters.base ?? {};
  }
}

class FakeRepository implements CollectorRepository {
  schools = new Map<number, SchoolRecord>();
  opportunities = new Map<string, OpportunityRecord>();
  staleListings: PurchaseOrderListRecord[] = [];
  private readonly existingExternalIds = new Set<string>();
  runs = new Map<number, Omit<CollectionRunResult, "runId">>();
  private nextRunId = 1;

  constructor(schools: SchoolRecord[] = [], existingExternalIds: string[] = []) {
    for (const school of schools) {
      this.schools.set(school.idSchool, school);
    }
    for (const externalId of existingExternalIds) {
      this.existingExternalIds.add(externalId);
    }
  }

  async startRun() {
    return this.nextRunId++;
  }

  async finishRun(runId: number, result: Omit<CollectionRunResult, "runId">) {
    this.runs.set(runId, result);
  }

  async upsertSchool(school: SchoolRecord) {
    this.schools.set(school.idSchool, school);
  }

  async getSchool(idSchool: number) {
    return this.schools.get(idSchool) ?? null;
  }

  async existsExternalId(externalId: string) {
    return this.opportunities.has(externalId) || this.existingExternalIds.has(externalId);
  }

  async upsertOpportunity(opportunity: OpportunityRecord) {
    const existed = await this.existsExternalId(opportunity.externalId);
    this.opportunities.set(opportunity.externalId, opportunity);
    this.existingExternalIds.add(opportunity.externalId);
    return existed ? "updated" : "new";
  }

  async listStaleOpportunityListings() {
    return this.staleListings;
  }
}
