import { sql, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { catalogItems, catalogSuppliers, preQuotes, preQuoteItems } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import { normalize } from "@/lib/text/normalize";

export type CatalogSupplier = {
  id: number;
  name: string;
  document: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  notes: string | null;
  active: boolean;
  itemCount: number;
  createdAt: string | null;
};

export type CatalogItem = {
  id: number;
  supplierId: number;
  supplierName: string;
  supplierActive: boolean;
  name: string;
  normalizedName: string;
  unit: string;
  unitPrice: number;
  notes: string | null;
  lastPriceAt: string | null;
};

export type CatalogSupplierInput = {
  name?: string;
  document?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  notes?: string | null;
  active?: boolean;
};

export type CatalogItemInput = {
  name?: string;
  unit?: string;
  unitPrice?: number;
  notes?: string | null;
};

export type PreQuoteLine = {
  id: number;
  itemOrder: number;
  name: string;
  description: string;
  unit: string;
  quantity: number;
  referenceValue: number | null;
  supplierId: number | null;
  catalogItemId: number | null;
  unitCost: number | null;
  totalCost: number | null;
  source: string;
  webTitle: string | null;
  webPrice: number | null;
  webUrl: string | null;
  webSearchedAt: string | null;
  notes: string | null;
};

export type PreQuote = {
  id: number;
  quotationExternalId: string;
  orderId: string | null;
  schoolName: string | null;
  city: string | null;
  expenseGroup: string | null;
  headline: string | null;
  marginPercent: number;
  freightCost: number;
  status: string;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  items: PreQuoteLine[];
};

export type PreQuoteLineInput = {
  itemOrder: number;
  name: string;
  description: string;
  unit: string;
  quantity: number;
  referenceValue: number | null;
  supplierId: number | null;
  catalogItemId: number | null;
  unitCost: number | null;
  source: "none" | "catalog" | "manual" | "web";
  webTitle?: string | null;
  webPrice?: number | null;
  webUrl?: string | null;
  notes?: string | null;
};

export type PreQuoteInput = {
  quotationExternalId: string;
  orderId?: string | null;
  schoolName?: string | null;
  city?: string | null;
  expenseGroup?: string | null;
  headline?: string | null;
  marginPercent?: number;
  freightCost?: number;
  status?: "draft" | "closed";
  notes?: string | null;
  items: PreQuoteLineInput[];
};

type CatalogDatabase = NodePgDatabase<typeof schema>;

type SupplierRow = {
  id: number;
  name: string;
  document: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  notes: string | null;
  active: boolean;
  created_at: Date | string;
  item_count: number;
};

type CatalogItemRow = {
  id: number;
  supplier_id: number;
  supplier_name: string;
  supplier_active: boolean;
  name: string;
  normalized_name: string;
  unit: string;
  unit_price: number;
  notes: string | null;
  last_price_at: Date | string;
};

type PreQuoteRow = {
  id: number;
  quotation_external_id: string;
  order_id: string | null;
  school_name: string | null;
  city: string | null;
  expense_group: string | null;
  headline: string | null;
  margin_percent: number;
  freight_cost: number;
  status: string;
  notes: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type PreQuoteItemRow = {
  id: number;
  pre_quote_id: number;
  item_order: number;
  name: string;
  description: string;
  unit: string;
  quantity: number;
  reference_value: number | null;
  supplier_id: number | null;
  catalog_item_id: number | null;
  unit_cost: number | null;
  total_cost: number | null;
  source: string;
  web_title: string | null;
  web_price: number | null;
  web_url: string | null;
  web_searched_at: Date | string | null;
  notes: string | null;
};

export class CatalogValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogValidationError";
  }
}

export function createCatalogSource(database: CatalogDatabase) {
  const source = {
    async listSuppliers(): Promise<CatalogSupplier[]> {
      const result = await database.execute<SupplierRow>(sql`
        select ${catalogSuppliers.id}, ${catalogSuppliers.name}, ${catalogSuppliers.document},
          ${catalogSuppliers.contactName}, ${catalogSuppliers.phone}, ${catalogSuppliers.email},
          ${catalogSuppliers.city}, ${catalogSuppliers.notes}, ${catalogSuppliers.active},
          ${catalogSuppliers.createdAt},
          count(${catalogItems.id})::integer as item_count
        from ${catalogSuppliers}
        left join ${catalogItems} on ${catalogItems.supplierId} = ${catalogSuppliers.id}
        group by ${catalogSuppliers.id}
        order by ${catalogSuppliers.name} asc
      `);
      return result.rows.map(toCatalogSupplier);
    },

    async getSupplier(id: number): Promise<CatalogSupplier | null> {
      const result = await database.execute<SupplierRow>(sql`
        select ${catalogSuppliers.id}, ${catalogSuppliers.name}, ${catalogSuppliers.document},
          ${catalogSuppliers.contactName}, ${catalogSuppliers.phone}, ${catalogSuppliers.email},
          ${catalogSuppliers.city}, ${catalogSuppliers.notes}, ${catalogSuppliers.active},
          ${catalogSuppliers.createdAt},
          count(${catalogItems.id})::integer as item_count
        from ${catalogSuppliers}
        left join ${catalogItems} on ${catalogItems.supplierId} = ${catalogSuppliers.id}
        where ${catalogSuppliers.id} = ${id}
        group by ${catalogSuppliers.id}
        limit 1
      `);
      const row = result.rows[0];
      return row ? toCatalogSupplier(row) : null;
    },

    async createSupplier(input: CatalogSupplierInput): Promise<CatalogSupplier> {
      const data = validateSupplierInput(input);
      const result = await database
        .insert(catalogSuppliers)
        .values({ ...data, updatedAt: new Date() })
        .returning({ id: catalogSuppliers.id });
      const created = await source.getSupplier(result[0].id);
      if (!created) throw new CatalogValidationError("Falha ao criar fornecedor.");
      return created;
    },

    async updateSupplier(id: number, input: CatalogSupplierInput): Promise<number | null> {
      const data = validateSupplierInput(input);
      const result = await database
        .update(catalogSuppliers)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(catalogSuppliers.id, id))
        .returning({ id: catalogSuppliers.id });
      return result.length > 0 ? result[0].id : null;
    },

    async deleteSupplier(id: number) {
      const result = await database
        .delete(catalogSuppliers)
        .where(eq(catalogSuppliers.id, id))
        .returning({ id: catalogSuppliers.id });
      return result.length > 0;
    },

    async listSupplierItems(supplierId: number): Promise<CatalogItem[]> {
      const result = await database.execute<CatalogItemRow>(sql`
        select ${catalogItems.id}, ${catalogItems.supplierId}, ${catalogSuppliers.name} as supplier_name,
          ${catalogSuppliers.active} as supplier_active, ${catalogItems.name}, ${catalogItems.normalizedName},
          ${catalogItems.unit}, ${catalogItems.unitPrice}, ${catalogItems.notes}, ${catalogItems.lastPriceAt}
        from ${catalogItems}
        join ${catalogSuppliers} on ${catalogSuppliers.id} = ${catalogItems.supplierId}
        where ${catalogItems.supplierId} = ${supplierId}
        order by ${catalogItems.name} asc
      `);
      return result.rows.map(toCatalogItem);
    },

    async listAllCatalogItems(): Promise<CatalogItem[]> {
      const result = await database.execute<CatalogItemRow>(sql`
        select ${catalogItems.id}, ${catalogItems.supplierId}, ${catalogSuppliers.name} as supplier_name,
          ${catalogSuppliers.active} as supplier_active, ${catalogItems.name}, ${catalogItems.normalizedName},
          ${catalogItems.unit}, ${catalogItems.unitPrice}, ${catalogItems.notes}, ${catalogItems.lastPriceAt}
        from ${catalogItems}
        join ${catalogSuppliers} on ${catalogSuppliers.id} = ${catalogItems.supplierId}
        order by ${catalogSuppliers.name} asc, ${catalogItems.name} asc
      `);
      return result.rows.map(toCatalogItem);
    },

    async upsertCatalogItem(supplierId: number, input: CatalogItemInput) {
      const data = validateItemInput(input);
      const normalizedName = normalize(data.name);
      const result = await database
        .insert(catalogItems)
        .values({
          supplierId,
          name: data.name,
          normalizedName,
          unit: data.unit,
          unitPrice: data.unitPrice,
          notes: data.notes,
          lastPriceAt: new Date(),
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: [catalogItems.supplierId, catalogItems.normalizedName, catalogItems.unit],
          set: {
            name: data.name,
            unitPrice: data.unitPrice,
            notes: data.notes,
            lastPriceAt: new Date(),
            updatedAt: new Date()
          }
        })
        .returning({ id: catalogItems.id });
      return result[0]?.id ?? null;
    },

    async updateCatalogItem(id: number, input: CatalogItemInput) {
      const data = validateItemInput(input);
      const normalizedName = normalize(data.name);
      const result = await database
        .update(catalogItems)
        .set({
          name: data.name,
          normalizedName,
          unit: data.unit,
          unitPrice: data.unitPrice,
          notes: data.notes,
          lastPriceAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(catalogItems.id, id))
        .returning({ id: catalogItems.id });
      return result.length > 0 ? result[0].id : null;
    },

    async deleteCatalogItem(id: number) {
      const result = await database
        .delete(catalogItems)
        .where(eq(catalogItems.id, id))
        .returning({ id: catalogItems.id });
      return result.length > 0;
    },

    async createPreQuote(input: PreQuoteInput) {
      const data = validatePreQuoteInput(input);
      return database.transaction(async (tx) => {
        const [header] = await tx
          .insert(preQuotes)
          .values({
            quotationExternalId: data.quotationExternalId,
            orderId: data.orderId ?? null,
            schoolName: data.schoolName ?? null,
            city: data.city ?? null,
            expenseGroup: data.expenseGroup ?? null,
            headline: data.headline ?? null,
            marginPercent: data.marginPercent ?? 0,
            freightCost: data.freightCost ?? 0,
            status: data.status ?? "draft",
            notes: data.notes ?? null,
            updatedAt: new Date()
          })
          .returning({ id: preQuotes.id });
        const id = header.id;
        await insertPreQuoteItems(tx, id, data.items);
        return id;
      });
    },

    async savePreQuote(id: number, input: PreQuoteInput) {
      const data = validatePreQuoteInput(input);
      return database.transaction(async (tx) => {
        await tx
          .update(preQuotes)
          .set({
            orderId: data.orderId ?? null,
            schoolName: data.schoolName ?? null,
            city: data.city ?? null,
            expenseGroup: data.expenseGroup ?? null,
            headline: data.headline ?? null,
            marginPercent: data.marginPercent ?? 0,
            freightCost: data.freightCost ?? 0,
            status: data.status ?? "draft",
            notes: data.notes ?? null,
            updatedAt: new Date()
          })
          .where(eq(preQuotes.id, id));
        await tx.delete(preQuoteItems).where(eq(preQuoteItems.preQuoteId, id));
        await insertPreQuoteItems(tx, id, data.items);
        return id;
      });
    },

    async getPreQuote(id: number): Promise<PreQuote | null> {
      const headerResult = await database.execute<PreQuoteRow>(sql`
        select * from ${preQuotes} where ${preQuotes.id} = ${id} limit 1
      `);
      const row = headerResult.rows[0];
      if (!row) return null;
      const itemsResult = await database.execute<PreQuoteItemRow>(sql`
        select * from ${preQuoteItems}
        where ${preQuoteItems.preQuoteId} = ${id}
        order by ${preQuoteItems.itemOrder} asc
      `);
      return toPreQuote(row, itemsResult.rows);
    },

    async getLatestPreQuoteForQuotation(externalId: string): Promise<PreQuote | null> {
      const result = await database.execute<{ id: number }>(sql`
        select ${preQuotes.id} from ${preQuotes}
        where ${preQuotes.quotationExternalId} = ${externalId}
        order by ${preQuotes.updatedAt} desc, ${preQuotes.id} desc
        limit 1
      `);
      const row = result.rows[0];
      return row ? source.getPreQuote(row.id) : null;
    },

    async listPreQuotes(): Promise<PreQuote[]> {
      const headerResult = await database.execute<PreQuoteRow>(sql`
        select * from ${preQuotes} order by ${preQuotes.updatedAt} desc, ${preQuotes.id} desc limit 200
      `);
      if (headerResult.rows.length === 0) return [];
      const ids = headerResult.rows.map((row) => row.id);
      const itemsResult = await database.execute<PreQuoteItemRow>(sql`
        select * from ${preQuoteItems}
        where ${preQuoteItems.preQuoteId} in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
        order by ${preQuoteItems.itemOrder} asc
      `);
      const itemsByQuote = new Map<number, PreQuoteItemRow[]>();
      for (const item of itemsResult.rows) {
        const list = itemsByQuote.get(item.pre_quote_id) ?? [];
        list.push(item);
        itemsByQuote.set(item.pre_quote_id, list);
      }
      return headerResult.rows.map((row) => toPreQuote(row, itemsByQuote.get(row.id) ?? []));
    },

    async deletePreQuote(id: number) {
      const result = await database
        .delete(preQuotes)
        .where(eq(preQuotes.id, id))
        .returning({ id: preQuotes.id });
      return result.length > 0;
    }
  };
  return source;
}

export type CatalogSource = ReturnType<typeof createCatalogSource>;

function validateSupplierInput(input: CatalogSupplierInput) {
  const name = requiredText(input.name, "Nome do fornecedor é obrigatório.");
  return {
    name,
    document: optionalText(input.document, 32),
    contactName: optionalText(input.contactName, 120),
    phone: optionalText(input.phone, 32),
    email: optionalText(input.email, 160),
    city: optionalText(input.city, 120),
    notes: optionalText(input.notes, 2000),
    active: typeof input.active === "boolean" ? input.active : true
  };
}

function validateItemInput(input: CatalogItemInput) {
  const name = requiredText(input.name, "Nome do item é obrigatório.");
  const unit = requiredText(input.unit, "Unidade é obrigatória.");
  const unitPrice = sanitizePrice(input.unitPrice);
  return { name, unit, unitPrice, notes: optionalText(input.notes, 1000) };
}

function validatePreQuoteInput(input: PreQuoteInput) {
  const quotationExternalId = requiredText(
    input.quotationExternalId,
    "Cotação de referência é obrigatória."
  );
  const marginPercent = sanitizePrice(input.marginPercent);
  const freightCost = sanitizePrice(input.freightCost);
  const status = input.status === "closed" ? "closed" : "draft";
  const items = (Array.isArray(input.items) ? input.items : []).map(validatePreQuoteLineInput);
  return {
    quotationExternalId,
    orderId: optionalText(input.orderId, 80),
    schoolName: optionalText(input.schoolName, 200),
    city: optionalText(input.city, 120),
    expenseGroup: optionalText(input.expenseGroup, 120),
    headline: optionalText(input.headline, 400),
    marginPercent,
    freightCost,
    status,
    notes: optionalText(input.notes, 4000),
    items
  };
}

function validatePreQuoteLineInput(input: PreQuoteLineInput): PreQuoteLineInput & { totalCost: number | null } {
  const quantity = Number.isFinite(input.quantity) && input.quantity > 0 ? input.quantity : 0;
  const unitCost =
    input.unitCost !== null && Number.isFinite(input.unitCost) && input.unitCost >= 0
      ? Math.round(input.unitCost * 100) / 100
      : null;
  const totalCost = unitCost !== null ? Math.round(quantity * unitCost * 100) / 100 : null;
  const source = ["catalog", "manual", "web"].includes(input.source) ? input.source : "none";
  return {
    itemOrder: Math.max(1, Math.floor(Number.isFinite(input.itemOrder) ? input.itemOrder : 1)),
    name: requiredText(input.name, "Nome do item é obrigatório."),
    description: optionalText(input.description, 2000) ?? "",
    unit: optionalText(input.unit, 40) ?? "",
    quantity,
    referenceValue: sanitizeNullablePrice(input.referenceValue),
    supplierId: sanitizeNullableInteger(input.supplierId),
    catalogItemId: sanitizeNullableInteger(input.catalogItemId),
    unitCost,
    totalCost,
    source,
    webTitle: optionalText(input.webTitle, 400),
    webPrice: sanitizeNullablePrice(input.webPrice),
    webUrl: optionalText(input.webUrl, 1000),
    notes: optionalText(input.notes, 1000)
  };
}

async function insertPreQuoteItems(
  database: Pick<CatalogDatabase, "insert">,
  preQuoteId: number,
  items: Array<PreQuoteLineInput & { totalCost: number | null }>
) {
  if (items.length === 0) return;
  await database.insert(preQuoteItems).values(
    items.map((item) => ({
      preQuoteId,
      itemOrder: item.itemOrder,
      name: item.name,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      referenceValue: item.referenceValue,
      supplierId: item.supplierId,
      catalogItemId: item.catalogItemId,
      unitCost: item.unitCost,
      totalCost: item.totalCost,
      source: item.source,
      webTitle: item.webTitle ?? null,
      webPrice: item.webPrice ?? null,
      webUrl: item.webUrl ?? null,
      webSearchedAt: item.webPrice !== null && item.webPrice !== undefined ? new Date() : null,
      notes: item.notes ?? null
    }))
  );
}

function toCatalogSupplier(row: SupplierRow): CatalogSupplier {
  return {
    id: row.id,
    name: row.name,
    document: row.document,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email,
    city: row.city,
    notes: row.notes,
    active: row.active,
    itemCount: row.item_count,
    createdAt: toIso(row.created_at)
  };
}

function toCatalogItem(row: CatalogItemRow): CatalogItem {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    supplierActive: row.supplier_active,
    name: row.name,
    normalizedName: row.normalized_name,
    unit: row.unit,
    unitPrice: row.unit_price,
    notes: row.notes,
    lastPriceAt: toIso(row.last_price_at)
  };
}

function toPreQuote(row: PreQuoteRow, items: PreQuoteItemRow[]): PreQuote {
  return {
    id: row.id,
    quotationExternalId: row.quotation_external_id,
    orderId: row.order_id,
    schoolName: row.school_name,
    city: row.city,
    expenseGroup: row.expense_group,
    headline: row.headline,
    marginPercent: row.margin_percent,
    freightCost: row.freight_cost,
    status: row.status,
    notes: row.notes,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    items: items.map((item) => ({
      id: item.id,
      itemOrder: item.item_order,
      name: item.name,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      referenceValue: item.reference_value,
      supplierId: item.supplier_id,
      catalogItemId: item.catalog_item_id,
      unitCost: item.unit_cost,
      totalCost: item.total_cost,
      source: item.source,
      webTitle: item.web_title,
      webPrice: item.web_price,
      webUrl: item.web_url,
      webSearchedAt: toIso(item.web_searched_at),
      notes: item.notes
    }))
  };
}

function requiredText(value: unknown, message: string) {
  const clean = optionalText(value, 4000);
  if (!clean) throw new CatalogValidationError(message);
  return clean;
}

function optionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean ? clean.slice(0, maxLength) : null;
}

function sanitizePrice(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : 0;
}

function sanitizeNullablePrice(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : null;
}

function sanitizeNullableInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
