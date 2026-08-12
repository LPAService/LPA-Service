import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    parentId: integer("parent_id"),
    active: boolean("active").notNull().default(true)
  },
  (table) => [
    uniqueIndex("categories_slug_idx").on(table.slug)
  ]
);

export const schools = pgTable(
  "schools",
  {
    idSchool: integer("id_school").primaryKey(),
    name: text("name").notNull(),
    idCounty: integer("id_county"),
    city: text("city"),
    regional: text("regional"),
    rawJson: jsonb("raw_json").notNull().default({}),
    collectedAt: timestamp("collected_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("schools_city_idx").on(table.city),
    index("schools_regional_idx").on(table.regional)
  ]
);

export const opportunities = pgTable(
  "opportunities",
  {
    id: serial("id").primaryKey(),
    externalId: text("external_id").notNull(),
    orderId: text("order_id").notNull(),
    sourceUrl: text("source_url").notNull(),
    idSubprogram: integer("id_subprogram").notNull(),
    idSchool: integer("id_school")
      .notNull()
      .references(() => schools.idSchool),
    idBudget: integer("id_budget").notNull(),
    idSupplier: integer("id_supplier"),
    school: text("school").notNull(),
    city: text("city"),
    regional: text("regional"),
    expenseGroup: text("expense_group").notNull(),
    subprogram: text("subprogram").notNull(),
    year: text("year").notNull(),
    purchaseDate: timestamp("purchase_date", { withTimezone: true }),
    proposalDate: timestamp("proposal_date", { withTimezone: true }),
    deliveryDate: timestamp("delivery_date", { withTimezone: true }),
    purchaseOrderStatus: text("purchase_order_status"),
    accountabilityStatus: text("accountability_status"),
    accountabilitySent: boolean("accountability_sent"),
    supplierName: text("supplier_name"),
    supplierDocument: text("supplier_document"),
    initiativeDescription: text("initiative_description"),
    totalValue: doublePrecision("total_value"),
    itemCount: integer("item_count").notNull().default(0),
    categoryId: integer("category_id").references(() => categories.id),
    headline: text("headline"),
    summary: text("summary"),
    topItems: jsonb("top_items"),
    rawJson: jsonb("raw_json").notNull().default({}),
    collectedAt: timestamp("collected_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("opportunities_external_id_unique").on(table.externalId),
    index("opportunities_natural_key_idx").on(table.idSubprogram, table.idSchool, table.idBudget),
    index("opportunities_order_id_idx").on(table.orderId),
    index("opportunities_school_idx").on(table.idSchool),
    index("opportunities_city_idx").on(table.city),
    index("opportunities_regional_idx").on(table.regional),
    index("opportunities_expense_group_idx").on(table.expenseGroup),
    index("opportunities_category_id_idx").on(table.categoryId),
    index("opportunities_purchase_date_idx").on(table.purchaseDate),
    index("opportunities_delivery_date_idx").on(table.deliveryDate),
    index("opportunities_purchase_status_idx").on(table.purchaseOrderStatus),
    index("opportunities_accountability_status_idx").on(table.accountabilityStatus)
  ]
);

export const items = pgTable(
  "items",
  {
    id: serial("id").primaryKey(),
    opportunityId: integer("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    itemOrder: integer("item_order").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    unit: text("unit").notNull(),
    quantity: doublePrecision("quantity").notNull(),
    unitValue: doublePrecision("unit_value"),
    totalValue: doublePrecision("total_value"),
    isPermanent: boolean("is_permanent").notNull(),
    expenseCategory: text("expense_category").notNull(),
    rawJson: jsonb("raw_json").notNull().default({})
  },
  (table) => [
    uniqueIndex("items_opportunity_order_unique").on(table.opportunityId, table.itemOrder),
    index("items_opportunity_id_idx").on(table.opportunityId)
  ]
);

export const attachments = pgTable(
  "attachments",
  {
    id: serial("id").primaryKey(),
    opportunityId: integer("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    externalAttachmentId: integer("external_attachment_id").notNull(),
    filename: text("filename").notNull(),
    thumbUrl: text("thumb_url").notNull(),
    url: text("url"),
    rawJson: jsonb("raw_json").notNull().default({})
  },
  (table) => [
    uniqueIndex("attachments_opportunity_external_unique").on(
      table.opportunityId,
      table.externalAttachmentId
    ),
    index("attachments_opportunity_id_idx").on(table.opportunityId)
  ]
);

export const collectionRuns = pgTable(
  "collection_runs",
  {
    id: serial("id").primaryKey(),
    mode: text("mode").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: text("status").notNull().default("running"),
    found: integer("found").notNull().default(0),
    newCount: integer("new_count").notNull().default(0),
    updatedCount: integer("updated_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    errors: jsonb("errors").notNull().default([])
  },
  (table) => [
    index("collection_runs_started_at_idx").on(table.startedAt),
    index("collection_runs_status_idx").on(table.status)
  ]
);

export const suppliers = pgTable(
  "suppliers",
  {
    id: serial("id").primaryKey(),
    document: text("document").notNull(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    city: text("city"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    totalOrders: integer("total_orders").notNull().default(0),
    totalValue: doublePrecision("total_value").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("suppliers_document_unique").on(table.document),
    index("suppliers_city_idx").on(table.city),
    index("suppliers_normalized_name_idx").on(table.normalizedName)
  ]
);

export const supplierProducts = pgTable(
  "supplier_products",
  {
    id: serial("id").primaryKey(),
    supplierId: integer("supplier_id").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
    productName: text("product_name").notNull(),
    normalizedProductName: text("normalized_product_name").notNull(),
    categoryId: integer("category_id").references(() => categories.id),
    timesSupplied: integer("times_supplied").notNull().default(0),
    totalQuantity: doublePrecision("total_quantity").notNull().default(0),
    avgUnitValue: doublePrecision("avg_unit_value"),
    minUnitValue: doublePrecision("min_unit_value"),
    maxUnitValue: doublePrecision("max_unit_value"),
    lastSuppliedAt: timestamp("last_supplied_at", { withTimezone: true })
  },
  (table) => [
    uniqueIndex("supplier_products_supplier_product_unique").on(table.supplierId, table.normalizedProductName),
    index("supplier_products_category_id_idx").on(table.categoryId),
    index("supplier_products_product_name_idx").on(table.normalizedProductName)
  ]
);

export const supplierCategories = pgTable(
  "supplier_categories",
  {
    id: serial("id").primaryKey(),
    supplierId: integer("supplier_id").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
    categoryId: integer("category_id").notNull().references(() => categories.id),
    orderCount: integer("order_count").notNull().default(0),
    totalValue: doublePrecision("total_value").notNull().default(0)
  },
  (table) => [
    uniqueIndex("supplier_categories_supplier_category_unique").on(table.supplierId, table.categoryId),
    index("supplier_categories_category_id_idx").on(table.categoryId)
  ]
);
