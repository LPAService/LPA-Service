import categoriesRaw from "@/lib/classification/categories.json";
import { classify, normalizar } from "@/lib/classification/classify";
import type { Classificacao } from "@/lib/classification/classify";
import { classifyExpenseGroup } from "@/lib/classification/expense-groups";
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
  prioridade?: number;
};

type RequiredIds = {
  idSubprogram: number;
  idSchool: number;
  idBudget: number;
};

type NormalizeErrorCode = "MISSING_REQUIRED_IDS";

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

export class NormalizeError extends Error {
  constructor(
    message: string,
    readonly code: NormalizeErrorCode,
    readonly context: { missing: string[] }
  ) {
    super(message);
    this.name = "NormalizeError";
  }
}

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

  const { idSubprogram, idSchool, idBudget } = requiredIds(listingRecord, detailRecord);
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
  const category = toOpportunityCategory(
    classifyOpportunity({
      expenseGroup,
      initiativeDescription,
      itemNames: normalizedItems.map((item) => item.name)
    })
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

function requiredIds(listingRecord: JsonObject, detailRecord: JsonObject): RequiredIds {
  const idSubprogram = numberValue(listingRecord.idSubprogram ?? detailRecord.idSubprogram);
  const idSchool = numberValue(listingRecord.idSchool ?? detailRecord.idSchool);
  const idBudget = numberValue(listingRecord.idBudget ?? detailRecord.idBudget);

  if (
    idSubprogram === null ||
    idSubprogram <= 0 ||
    idSchool === null ||
    idSchool <= 0 ||
    idBudget === null ||
    idBudget <= 0
  ) {
    const missing = [
      ["idSubprogram", idSubprogram],
      ["idSchool", idSchool],
      ["idBudget", idBudget]
    ]
      .filter(([, value]) => value === null || Number(value) <= 0)
      .map(([field]) => String(field));

    throw new NormalizeError(
      `Opportunity payload missing required ids: ${missing.join(", ")}`,
      "MISSING_REQUIRED_IDS",
      { missing }
    );
  }

  return { idSubprogram, idSchool, idBudget };
}

function classifyOpportunity(input: {
  expenseGroup: string;
  initiativeDescription: string | null;
  itemNames: string[];
}): Classificacao {
  const realItems = input.itemNames.filter((item) => item.trim().length > 0);
  const itemResult =
    realItems.length > 0 ? classifyByIndividualItems(realItems) ?? classify("", realItems) : null;
  if (itemResult && !itemResult.needsFallback) return itemResult;

  const canUseInitiative =
    input.initiativeDescription && !looksLikeProgramCatalog(input.initiativeDescription);
  const initiativeResult = canUseInitiative
    ? demoteConfidence(classify(input.initiativeDescription ?? ""), 0.35)
    : null;
  if (realItems.length === 0 && initiativeResult && !initiativeResult.needsFallback) {
    return initiativeResult;
  }

  const expenseGroupResult = classifyExpenseGroup(input.expenseGroup);
  if (expenseGroupResult) return expenseGroupResult;

  const semanticResult = input.expenseGroup
    ? demoteConfidence(classify(input.expenseGroup), 0.45)
    : null;
  if (semanticResult && !semanticResult.needsFallback) return semanticResult;

  if (initiativeResult && !initiativeResult.needsFallback) return initiativeResult;

  return itemResult ?? semanticResult ?? initiativeResult ?? classify("");
}

function classifyByIndividualItems(itemNames: string[]): Classificacao | null {
  const scores = new Map<
    string,
    { count: number; confidence: number; matchedRules: Set<string> }
  >();

  for (const itemName of itemNames) {
    const result = classify(itemName);
    if (result.needsFallback) continue;

    const score = scores.get(result.categoryId) ?? {
      count: 0,
      confidence: 0,
      matchedRules: new Set<string>()
    };

    score.count += 1;
    score.confidence += result.confidence;
    result.matchedRules.forEach((rule) => score.matchedRules.add(rule));
    scores.set(result.categoryId, score);
  }

  let best: { slug: string; count: number; confidence: number; matchedRules: Set<string> } | null =
    null;

  for (const [slug, score] of scores) {
    if (
      best === null ||
      score.count > best.count ||
      (score.count === best.count && score.confidence > best.confidence) ||
      (score.count === best.count &&
        score.confidence === best.confidence &&
        categoryPriority(slug) > categoryPriority(best.slug))
    ) {
      best = { slug, ...score };
    }
  }

  if (!best) return null;

  return {
    categoryId: best.slug,
    confidence: roundMoney(best.confidence / best.count),
    matchedRules: Array.from(best.matchedRules),
    needsFallback: false
  };
}

function categoryPriority(slug: string): number {
  return categoriesBySlug.get(slug)?.prioridade ?? 0;
}

function demoteConfidence(result: Classificacao, multiplier: number): Classificacao {
  return {
    ...result,
    confidence: roundMoney(result.confidence * multiplier)
  };
}

function looksLikeProgramCatalog(value: string): boolean {
  const text = normalizar(value);
  const families = [
    /\b(acougue|carne|bovina|suina|ave|frango|peixe)\b/,
    /\b(laticinio|leite|iogurte|queijo|manteiga|margarina)\b/,
    /\b(farinaceo|arroz|macarrao|farinha|fuba|trigo)\b/,
    /\b(padaria|panificacao|pao|bolo|biscoito|bolacha)\b/,
    /\b(hortifruti|hortifrutigranjeiro|fruta|legume|verdura|hortalica|ovo)\b/,
    /\b(mercearia|acucar|sal|oleo|vinagre|colorau|oregano|acafrao|tempero)\b/
  ];

  return families.filter((family) => family.test(text)).length >= 3;
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
