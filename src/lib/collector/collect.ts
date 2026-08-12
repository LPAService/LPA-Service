import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  attachments,
  collectionRuns,
  items,
  opportunities,
  schools
} from "@/lib/db/schema";
import * as dbSchema from "@/lib/db/schema";
import type {
  PaginatedResponse,
  PortalFilters,
  PortalSchool,
  PurchaseOrderAttachment,
  PurchaseOrderDetail,
  PurchaseOrderItem,
  PurchaseOrderItemsQuery,
  PurchaseOrderKey,
  PurchaseOrderListRecord,
  PurchaseOrdersQuery,
  PortalFiltersQuery
} from "./client";
import { CAIXA_ESCOLAR_API_BASE_URL } from "./client";

export type CollectMode = "full" | "incremental";

export type CollectOptions = {
  mode?: CollectMode;
  pageSize?: number;
  itemPageSize?: number;
  maxPages?: number;
  maxRecords?: number;
  refreshSchools?: boolean;
  filters?: Omit<PurchaseOrdersQuery, "page" | "pageSize" | "sortBy" | "sortDir">;
};

export type CollectionRunResult = {
  runId: number;
  status: "completed" | "failed";
  found: number;
  newCount: number;
  updatedCount: number;
  errorCount: number;
  errors: CollectionError[];
};

export type CollectionError = {
  externalId?: string;
  message: string;
};

export type SchoolRecord = {
  idSchool: number;
  name: string;
  idCounty: number;
  city: string;
  regional: string | null;
  rawJson: unknown;
};

export type OpportunityRecord = {
  externalId: string;
  orderId: string;
  sourceUrl: string;
  idSubprogram: number;
  idSchool: number;
  idBudget: number;
  idSupplier: number | null;
  school: string;
  city: string | null;
  regional: string | null;
  expenseGroup: string;
  subprogram: string;
  year: string;
  purchaseDate: Date | null;
  proposalDate: Date | null;
  deliveryDate: Date | null;
  purchaseOrderStatus: string | null;
  accountabilityStatus: string | null;
  accountabilitySent: boolean | null;
  supplierName: string | null;
  supplierDocument: string | null;
  initiativeDescription: string | null;
  totalValue: number | null;
  itemCount: number;
  rawJson: unknown;
  items: ItemRecord[];
  attachments: AttachmentRecord[];
};

export type ItemRecord = {
  itemOrder: number;
  name: string;
  description: string;
  unit: string;
  quantity: number;
  unitValue: number | null;
  totalValue: number | null;
  isPermanent: boolean;
  expenseCategory: string;
  rawJson: unknown;
};

export type AttachmentRecord = {
  externalAttachmentId: number;
  filename: string;
  thumbUrl: string;
  url: string | null;
  rawJson: unknown;
};

export type CollectorClient = {
  listPurchaseOrders(
    query: PurchaseOrdersQuery
  ): Promise<PaginatedResponse<PurchaseOrderListRecord>>;
  getPurchaseOrderDetail(key: PurchaseOrderKey): Promise<PurchaseOrderDetail>;
  listPurchaseOrderItems(
    query: PurchaseOrderItemsQuery
  ): Promise<PaginatedResponse<PurchaseOrderItem>>;
  getPurchaseOrderImages(key: PurchaseOrderKey): Promise<PurchaseOrderAttachment[]>;
  getPortalFilters(query?: PortalFiltersQuery): Promise<PortalFilters>;
};

export type CollectorRepository = {
  startRun(mode: CollectMode): Promise<number>;
  finishRun(runId: number, result: Omit<CollectionRunResult, "runId">): Promise<void>;
  upsertSchool(school: SchoolRecord): Promise<void>;
  getSchool(idSchool: number): Promise<SchoolRecord | null>;
  existsExternalId(externalId: string): Promise<boolean>;
  upsertOpportunity(opportunity: OpportunityRecord): Promise<"new" | "updated">;
};

export async function collectOpportunities(
  client: CollectorClient,
  repository?: CollectorRepository,
  options: CollectOptions = {}
): Promise<CollectionRunResult> {
  const activeRepository = repository ?? (await createDefaultRepository());
  const mode = options.mode ?? "incremental";
  const pageSize = options.pageSize ?? 50;
  const runId = await activeRepository.startRun(mode);
  const result: CollectionRunResult = {
    runId,
    status: "completed",
    found: 0,
    newCount: 0,
    updatedCount: 0,
    errorCount: 0,
    errors: []
  };

  try {
    if (options.refreshSchools ?? true) {
      await collectSchoolDimension(client, activeRepository);
    }

    let shouldStop = false;
    let processed = 0;

    for (let page = 1; !shouldStop; page += 1) {
      if (options.maxPages && page > options.maxPages) {
        break;
      }

      const listing = await client.listPurchaseOrders({
        ...options.filters,
        page,
        pageSize,
        ...(mode === "incremental"
          ? { sortBy: "dtPurchaseOrder", sortDir: "DESC" as const }
          : {})
      });

      if (listing.data.length === 0) {
        break;
      }

      for (const record of listing.data) {
        if (options.maxRecords && processed >= options.maxRecords) {
          shouldStop = true;
          break;
        }

        const externalId = buildExternalId(record);
        if (mode === "incremental" && (await activeRepository.existsExternalId(externalId))) {
          shouldStop = true;
          break;
        }

        result.found += 1;
        processed += 1;

        try {
          const opportunity = await buildOpportunityRecord(
            client,
            activeRepository,
            record,
            options.itemPageSize ?? 100
          );
          const upsertResult = await activeRepository.upsertOpportunity(opportunity);
          if (upsertResult === "new") {
            result.newCount += 1;
          } else {
            result.updatedCount += 1;
          }
        } catch (error) {
          result.errorCount += 1;
          result.errors.push({
            externalId,
            message: errorMessage(error)
          });
        }
      }

      if (page >= listing.meta.totalPages) {
        break;
      }
    }

    await activeRepository.finishRun(runId, {
      status: result.status,
      found: result.found,
      newCount: result.newCount,
      updatedCount: result.updatedCount,
      errorCount: result.errorCount,
      errors: result.errors
    });
    return result;
  } catch (error) {
    result.status = "failed";
    result.errorCount += 1;
    result.errors.push({ message: errorMessage(error) });
    await activeRepository.finishRun(runId, {
      status: result.status,
      found: result.found,
      newCount: result.newCount,
      updatedCount: result.updatedCount,
      errorCount: result.errorCount,
      errors: result.errors
    });
    throw error;
  }
}

export async function collectSchoolDimension(
  client: Pick<CollectorClient, "getPortalFilters">,
  repository: Pick<CollectorRepository, "upsertSchool">
) {
  const baseFilters = await client.getPortalFilters({});
  const counties = baseFilters.counties ?? [];
  let count = 0;

  for (const county of counties) {
    const countyFilters = await client.getPortalFilters({ county: county.idCounty });
    const regionals = countyFilters.regionals ?? [];

    if (regionals.length > 1) {
      for (const regional of regionals) {
        const regionalFilters = await client.getPortalFilters({
          county: county.idCounty,
          regional: regional.idNetwork
        });
        count += await upsertFilterSchools(
          repository,
          regionalFilters.schools ?? [],
          county.idCounty,
          county.txCounty,
          regional.txName
        );
      }
      continue;
    }

    count += await upsertFilterSchools(
      repository,
      countyFilters.schools ?? [],
      county.idCounty,
      county.txCounty,
      regionals[0]?.txName ?? null
    );
  }

  return count;
}

export function buildExternalId(record: Pick<PurchaseOrderListRecord, "idSubprogram" | "idSchool" | "idBudget">) {
  return `${record.idSubprogram}-${record.idSchool}-${record.idBudget}`;
}

async function buildOpportunityRecord(
  client: CollectorClient,
  repository: Pick<CollectorRepository, "getSchool">,
  listing: PurchaseOrderListRecord,
  itemPageSize: number
): Promise<OpportunityRecord> {
  const key = {
    idSubprogram: listing.idSubprogram,
    idSchool: listing.idSchool,
    idBudget: listing.idBudget
  };
  const schoolPromise = repository.getSchool(listing.idSchool);
  const detail = await client.getPurchaseOrderDetail(key);
  const sourceItems = await fetchAllItems(client, key, listing.idSupplier, itemPageSize);
  const sourceAttachments = await client.getPurchaseOrderImages(key);
  const school = await schoolPromise;

  const mappedItems = sourceItems.map(mapItem);
  const valuedItems = mappedItems.filter((item) => item.totalValue !== null);
  const totalValue =
    valuedItems.length === 0
      ? null
      : valuedItems.reduce((total, item) => total + (item.totalValue ?? 0), 0);

  return {
    externalId: buildExternalId(listing),
    orderId: detail.budgetOrder ?? listing.orderId,
    sourceUrl: buildDetailSourceUrl(key),
    idSubprogram: listing.idSubprogram,
    idSchool: listing.idSchool,
    idBudget: listing.idBudget,
    idSupplier: listing.idSupplier,
    school: listing.school,
    city: school?.city ?? null,
    regional: school?.regional ?? null,
    expenseGroup: detail.expenseGroupDescription ?? listing.expenseGroup,
    subprogram: detail.subprogramName ?? listing.subprogram,
    year: String(detail.year ?? listing.year),
    purchaseDate: parseDate(listing.purchaseDate),
    proposalDate: parseDate(detail.dtProposalSubmission),
    deliveryDate: parseDate(detail.dtDelivery),
    purchaseOrderStatus: detail.purchaseOrderStatus,
    accountabilityStatus: listing.accountabilityStatus,
    accountabilitySent: listing.accountabilitySent,
    supplierName: detail.supplierName,
    supplierDocument: detail.supplierDocument,
    initiativeDescription: detail.initiativeDescription,
    totalValue,
    itemCount: mappedItems.length,
    rawJson: {
      listing,
      detail,
      items: sourceItems,
      attachments: sourceAttachments
    },
    items: mappedItems,
    attachments: sourceAttachments.map(mapAttachment)
  };
}

async function fetchAllItems(
  client: Pick<CollectorClient, "listPurchaseOrderItems">,
  key: PurchaseOrderKey,
  idSupplier: number | null,
  pageSize: number
) {
  const allItems: PurchaseOrderItem[] = [];

  for (let page = 1; ; page += 1) {
    const response = await client.listPurchaseOrderItems({
      ...key,
      idSupplier,
      page,
      pageSize,
      sortBy: "budgetItem.nuItemOrder:ASC"
    });

    allItems.push(...response.data);
    if (response.data.length === 0 || page >= response.meta.totalPages) {
      break;
    }
  }

  return allItems;
}

function mapItem(item: PurchaseOrderItem): ItemRecord {
  const unitValue = item.nuValueByItem;
  const totalValue = unitValue === null ? null : item.nuQuantity * unitValue;

  return {
    itemOrder: item.nuItemOrder,
    name: item.txBudgetItemType ?? "",
    description: item.txDescription ?? "",
    unit: item.txBudgetItemUnit ?? "",
    quantity: item.nuQuantity,
    unitValue,
    totalValue,
    isPermanent: item.inPermanent,
    expenseCategory: item.txExpenseCategory ?? "",
    rawJson: item
  };
}

function mapAttachment(attachment: PurchaseOrderAttachment): AttachmentRecord {
  return {
    externalAttachmentId: attachment.id,
    filename: attachment.filename,
    thumbUrl: attachment.thumbUrl,
    url: attachment.url === "" ? null : attachment.url,
    rawJson: attachment
  };
}

async function upsertFilterSchools(
  repository: Pick<CollectorRepository, "upsertSchool">,
  filterSchools: PortalSchool[],
  idCounty: number,
  city: string,
  regional: string | null
) {
  const seen = new Set<number>();
  let count = 0;

  for (const school of filterSchools) {
    if (seen.has(school.idSchool)) {
      continue;
    }
    seen.add(school.idSchool);
    await repository.upsertSchool({
      idSchool: school.idSchool,
      name: school.txName,
      idCounty,
      city,
      regional,
      rawJson: {
        school,
        county: { idCounty, txCounty: city },
        regional
      }
    });
    count += 1;
  }

  return count;
}

function buildDetailSourceUrl(key: PurchaseOrderKey) {
  const url = new URL(
    `/public/purchase-orders/by-subprogram/${key.idSubprogram}/by-school/${key.idSchool}/by-budget/${key.idBudget}/detail`,
    CAIXA_ESCOLAR_API_BASE_URL
  );
  url.searchParams.set("portalSlug", "mg");
  return url.toString();
}

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export class DrizzleCollectorRepository implements CollectorRepository {
  constructor(private readonly database: NodePgDatabase<typeof dbSchema>) {}

  async startRun(mode: CollectMode) {
    const [run] = await this.database
      .insert(collectionRuns)
      .values({ mode })
      .returning({ id: collectionRuns.id });

    return run.id;
  }

  async finishRun(runId: number, result: Omit<CollectionRunResult, "runId">) {
    await this.database
      .update(collectionRuns)
      .set({
        status: result.status,
        finishedAt: new Date(),
        found: result.found,
        newCount: result.newCount,
        updatedCount: result.updatedCount,
        errorCount: result.errorCount,
        errors: result.errors
      })
      .where(eq(collectionRuns.id, runId));
  }

  async upsertSchool(school: SchoolRecord) {
    await this.database
      .insert(schools)
      .values({
        idSchool: school.idSchool,
        name: school.name,
        idCounty: school.idCounty,
        city: school.city,
        regional: school.regional,
        rawJson: school.rawJson
      })
      .onConflictDoUpdate({
        target: schools.idSchool,
        set: {
          name: school.name,
          idCounty: school.idCounty,
          city: school.city,
          regional: school.regional,
          rawJson: school.rawJson,
          updatedAt: new Date()
        }
      });
  }

  async getSchool(idSchool: number) {
    const [school] = await this.database
      .select({
        idSchool: schools.idSchool,
        name: schools.name,
        idCounty: schools.idCounty,
        city: schools.city,
        regional: schools.regional,
        rawJson: schools.rawJson
      })
      .from(schools)
      .where(eq(schools.idSchool, idSchool))
      .limit(1);

    return school ?? null;
  }

  async existsExternalId(externalId: string) {
    const [opportunity] = await this.database
      .select({ id: opportunities.id })
      .from(opportunities)
      .where(eq(opportunities.externalId, externalId))
      .limit(1);

    return Boolean(opportunity);
  }

  async upsertOpportunity(opportunity: OpportunityRecord) {
    const existed = await this.existsExternalId(opportunity.externalId);
    const [savedOpportunity] = await this.database
      .insert(opportunities)
      .values({
        externalId: opportunity.externalId,
        orderId: opportunity.orderId,
        sourceUrl: opportunity.sourceUrl,
        idSubprogram: opportunity.idSubprogram,
        idSchool: opportunity.idSchool,
        idBudget: opportunity.idBudget,
        idSupplier: opportunity.idSupplier,
        school: opportunity.school,
        city: opportunity.city,
        regional: opportunity.regional,
        expenseGroup: opportunity.expenseGroup,
        subprogram: opportunity.subprogram,
        year: opportunity.year,
        purchaseDate: opportunity.purchaseDate,
        proposalDate: opportunity.proposalDate,
        deliveryDate: opportunity.deliveryDate,
        purchaseOrderStatus: opportunity.purchaseOrderStatus,
        accountabilityStatus: opportunity.accountabilityStatus,
        accountabilitySent: opportunity.accountabilitySent,
        supplierName: opportunity.supplierName,
        supplierDocument: opportunity.supplierDocument,
        initiativeDescription: opportunity.initiativeDescription,
        totalValue: opportunity.totalValue,
        itemCount: opportunity.itemCount,
        rawJson: opportunity.rawJson
      })
      .onConflictDoUpdate({
        target: opportunities.externalId,
        set: {
          orderId: opportunity.orderId,
          sourceUrl: opportunity.sourceUrl,
          idSubprogram: opportunity.idSubprogram,
          idSchool: opportunity.idSchool,
          idBudget: opportunity.idBudget,
          idSupplier: opportunity.idSupplier,
          school: opportunity.school,
          city: opportunity.city,
          regional: opportunity.regional,
          expenseGroup: opportunity.expenseGroup,
          subprogram: opportunity.subprogram,
          year: opportunity.year,
          purchaseDate: opportunity.purchaseDate,
          proposalDate: opportunity.proposalDate,
          deliveryDate: opportunity.deliveryDate,
          purchaseOrderStatus: opportunity.purchaseOrderStatus,
          accountabilityStatus: opportunity.accountabilityStatus,
          accountabilitySent: opportunity.accountabilitySent,
          supplierName: opportunity.supplierName,
          supplierDocument: opportunity.supplierDocument,
          initiativeDescription: opportunity.initiativeDescription,
          totalValue: opportunity.totalValue,
          itemCount: opportunity.itemCount,
          rawJson: opportunity.rawJson,
          updatedAt: new Date()
        }
      })
      .returning({ id: opportunities.id });

    await this.database.delete(items).where(eq(items.opportunityId, savedOpportunity.id));
    await this.database
      .delete(attachments)
      .where(eq(attachments.opportunityId, savedOpportunity.id));

    if (opportunity.items.length > 0) {
      await this.database.insert(items).values(
        opportunity.items.map((item) => ({
          opportunityId: savedOpportunity.id,
          itemOrder: item.itemOrder,
          name: item.name,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          unitValue: item.unitValue,
          totalValue: item.totalValue,
          isPermanent: item.isPermanent,
          expenseCategory: item.expenseCategory,
          rawJson: item.rawJson
        }))
      );
    }

    if (opportunity.attachments.length > 0) {
      await this.database.insert(attachments).values(
        opportunity.attachments.map((attachment) => ({
          opportunityId: savedOpportunity.id,
          externalAttachmentId: attachment.externalAttachmentId,
          filename: attachment.filename,
          thumbUrl: attachment.thumbUrl,
          url: attachment.url,
          rawJson: attachment.rawJson
        }))
      );
    }

    return existed ? "updated" : "new";
  }
}

async function createDefaultRepository() {
  const { db } = await import("@/lib/db");
  return new DrizzleCollectorRepository(db);
}
