import categoriesRaw from "@/lib/classification/categories.json";
import { classify } from "@/lib/classification/classify";
import type {
  NormalizedOpportunity,
  OpportunityAttachment,
  OpportunityCategory,
  OpportunityItem
} from "@/lib/contracts/opportunity";
import { summarize } from "@/lib/parsing/summarize";

type JsonObject = Record<string, unknown>;

type CategoryRecord = {
  slug: string;
  name: string;
};

type SchoolInput =
  | string
  | {
      name?: unknown;
      school?: unknown;
      txName?: unknown;
      city?: unknown;
      county?: unknown;
      municipality?: unknown;
      txCounty?: unknown;
      regional?: unknown;
      txRegional?: unknown;
      network?: unknown;
      txNetwork?: unknown;
    };

const SOURCE_BASE_URL =
  "https://transparencia-api.caixaescolar.educacao.mg.gov.br/public/purchase-orders";

const categories = categoriesRaw as CategoryRecord[];
const categoriesBySlug = new Map(categories.map((category) => [category.slug, category]));

export function normalize(
  listing: unknown,
  detail: unknown,
  items: unknown,
  attachments: unknown,
  school?: SchoolInput
): NormalizedOpportunity {
  const listingRecord = asRecord(listing);
  const detailRecord = asRecord(detail);
  const schoolRecord = typeof school === "string" ? {} : asRecord(school);

  const idSubprogram =
    numberValue(listingRecord.idSubprogram) ?? numberValue(detailRecord.idSubprogram) ?? 0;
  const idSchool = numberValue(listingRecord.idSchool) ?? numberValue(detailRecord.idSchool) ?? 0;
  const idBudget = numberValue(listingRecord.idBudget) ?? numberValue(detailRecord.idBudget) ?? 0;
  const idSupplier = optionalNumber(listingRecord.idSupplier ?? detailRecord.idSupplier);

  const normalizedItems = normalizeItems(items);
  const normalizedAttachments = normalizeAttachments(attachments);

  const orderId =
    stringValue(listingRecord.orderId) ||
    stringValue(detailRecord.budgetOrder) ||
    stringValue(detailRecord.orderId);
  const expenseGroup =
    stringValue(listingRecord.expenseGroup) ||
    stringValue(detailRecord.expenseGroupDescription);
  const subprogram =
    stringValue(listingRecord.subprogram) ||
    stringValue(detailRecord.subprogramName);
  const initiativeDescription = nullableString(detailRecord.initiativeDescription);
  const summarySeed = summarize({
    category: null,
    initiativeDescription,
    expenseGroup,
    items: normalizedItems
  });
  const category = toOpportunityCategory(
    classify([subprogram, initiativeDescription, expenseGroup].filter(Boolean).join(" "), summarySeed.topItems)
  );
  const summary = summarize({
    category,
    initiativeDescription,
    expenseGroup,
    items: normalizedItems
  });

  return {
    externalId: `${idSubprogram}-${idSchool}-${idBudget}`,
    orderId,
    sourceUrl: buildSourceUrl(idSubprogram, idSchool, idBudget),
    idSubprogram,
    idSchool,
    idBudget,
    idSupplier,
    school: schoolName(school, schoolRecord, listingRecord),
    city: nullableString(
      schoolRecord.city ??
        schoolRecord.county ??
        schoolRecord.municipality ??
        schoolRecord.txCounty ??
        listingRecord.city ??
        listingRecord.county ??
        listingRecord.municipality
    ),
    regional: nullableString(
      schoolRecord.regional ??
        schoolRecord.txRegional ??
        schoolRecord.network ??
        schoolRecord.txNetwork ??
        listingRecord.regional ??
        listingRecord.network
    ),
    expenseGroup,
    subprogram,
    year: stringValue(listingRecord.year) || stringValue(detailRecord.year),
    purchaseDate: nullableString(listingRecord.purchaseDate ?? listingRecord.dtPurchaseOrder),
    proposalDate: nullableString(detailRecord.dtProposalSubmission),
    deliveryDate: nullableString(detailRecord.dtDelivery),
    purchaseOrderStatus: nullableString(
      detailRecord.purchaseOrderStatus ?? listingRecord.purchaseOrderStatus
    ),
    accountabilityStatus: nullableString(
      listingRecord.accountabilityStatus ?? detailRecord.accountabilityStatus
    ),
    supplierName: nullableString(detailRecord.supplierName ?? listingRecord.supplierName),
    supplierDocument: nullableString(
      detailRecord.supplierDocument ?? listingRecord.supplierDocument
    ),
    initiativeDescription,
    items: normalizedItems,
    attachments: normalizedAttachments,
    totalValue: totalValueFromItems(normalizedItems),
    itemCount: normalizedItems.length,
    category,
    headline: summary.headline,
    summary: summary.summary,
    topItems: summary.topItems,
    rawJson: {
      listing,
      detail,
      items,
      attachments,
      school
    }
  };
}

function normalizeItems(input: unknown): OpportunityItem[] {
  return arrayPayload(input)
    .map(asRecord)
    .filter((item) => Object.keys(item).length > 0)
    .map((item, index) => {
      const quantityRaw = optionalNumber(item.nuQuantity);
      const unitValue = optionalNumber(item.nuValueByItem);
      const quantity = quantityRaw ?? 0;
      const totalValue =
        quantityRaw === null || unitValue === null ? null : roundMoney(quantityRaw * unitValue);

      return {
        order: numberValue(item.nuItemOrder) ?? index + 1,
        name: stringValue(item.txBudgetItemType),
        description: stringValue(item.txDescription),
        unit: stringValue(item.txBudgetItemUnit),
        quantity,
        unitValue,
        totalValue,
        isPermanent: booleanValue(item.inPermanent),
        expenseCategory: stringValue(item.txExpenseCategory)
      };
    })
    .sort((a, b) => a.order - b.order);
}

function normalizeAttachments(input: unknown): OpportunityAttachment[] {
  return arrayPayload(input)
    .map(asRecord)
    .filter((attachment) => Object.keys(attachment).length > 0)
    .map((attachment) => ({
      id: numberValue(attachment.id) ?? 0,
      filename: stringValue(attachment.filename),
      thumbUrl: stringValue(attachment.thumbUrl),
      url: nullableString(attachment.url)
    }));
}

function toOpportunityCategory(result: ReturnType<typeof classify>): OpportunityCategory {
  const slug = result.needsFallback ? "outros" : result.categoryId;
  const category = categoriesBySlug.get(slug) ?? categoriesBySlug.get("outros");

  return {
    slug: category?.slug ?? "outros",
    name: category?.name ?? "Outros",
    confidence: result.confidence,
    needsFallback: result.needsFallback
  };
}

function totalValueFromItems(items: OpportunityItem[]): number | null {
  let total = 0;
  let hasValue = false;

  for (const item of items) {
    if (item.totalValue === null) continue;
    total += item.totalValue;
    hasValue = true;
  }

  return hasValue ? roundMoney(total) : null;
}

function schoolName(
  school: SchoolInput | undefined,
  schoolRecord: JsonObject,
  listingRecord: JsonObject
): string {
  if (typeof school === "string") return stringValue(school) || stringValue(listingRecord.school);
  return (
    stringValue(schoolRecord.name) ||
    stringValue(schoolRecord.school) ||
    stringValue(schoolRecord.txName) ||
    stringValue(listingRecord.school)
  );
}

function buildSourceUrl(idSubprogram: number, idSchool: number, idBudget: number): string {
  return `${SOURCE_BASE_URL}/by-subprogram/${idSubprogram}/by-school/${idSchool}/by-budget/${idBudget}?portalSlug=mg`;
}

function asRecord(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function arrayPayload(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  return Array.isArray(record.data) ? record.data : [];
}

function stringValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function nullableString(value: unknown): string | null {
  const text = stringValue(value);
  return text.length > 0 ? text : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function optionalNumber(value: unknown): number | null {
  return numberValue(value);
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
