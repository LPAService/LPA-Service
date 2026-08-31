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

export const quotations = pgTable(
  "quotations",
  {
    id: serial("id").primaryKey(),
    externalId: text("external_id").notNull(),
    nuBudgetOrder: text("nu_budget_order"),
    idSubprogram: integer("id_subprogram").notNull(),
    idSchool: integer("id_school").notNull(),
    idBudget: integer("id_budget").notNull(),
    idCounty: integer("id_county"),
    countyName: text("county_name"),
    schoolName: text("school_name").notNull(),
    expenseGroup: text("expense_group").notNull(),
    categoryId: integer("category_id").references(() => categories.id),
    headline: text("headline").notNull(),
    summary: text("summary").notNull(),
    topItems: jsonb("top_items").notNull().default([]),
    proposalDeadline: timestamp("proposal_deadline", { withTimezone: true }),
    deliveryDate: timestamp("delivery_date", { withTimezone: true }),
    itemCount: integer("item_count").notNull().default(0),
    totalReferenceValue: doublePrecision("total_reference_value"),
    budgetStatus: text("budget_status"),
    supplierStatus: text("supplier_status"),
    proposalUrl: text("proposal_url").notNull(),
    proposalBlocked: boolean("proposal_blocked").notNull().default(false),
    proposalBlockedReason: text("proposal_blocked_reason"),
    proposalBlockedItemCount: integer("proposal_blocked_item_count").notNull().default(0),
    proposalSuspect: boolean("proposal_suspect").notNull().default(false),
    proposalSuspectItemCount: integer("proposal_suspect_item_count").notNull().default(0),
    rawJson: jsonb("raw_json").notNull().default({}),
    collectedAt: timestamp("collected_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("quotations_external_id_unique").on(table.externalId),
    index("quotations_natural_key_idx").on(table.idSubprogram, table.idSchool, table.idBudget),
    index("quotations_county_idx").on(table.idCounty),
    index("quotations_school_idx").on(table.idSchool),
    index("quotations_expense_group_idx").on(table.expenseGroup),
    index("quotations_category_id_idx").on(table.categoryId),
    index("quotations_proposal_deadline_idx").on(table.proposalDeadline),
    index("quotations_supplier_status_idx").on(table.supplierStatus)
  ]
);

export const quotationItems = pgTable(
  "quotation_items",
  {
    id: serial("id").primaryKey(),
    quotationId: integer("quotation_id")
      .notNull()
      .references(() => quotations.id, { onDelete: "cascade" }),
    itemOrder: integer("item_order").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    unit: text("unit").notNull(),
    quantity: doublePrecision("quantity").notNull(),
    referenceValue: doublePrecision("reference_value"),
    rawJson: jsonb("raw_json").notNull().default({})
  },
  (table) => [
    uniqueIndex("quotation_items_quotation_order_unique").on(table.quotationId, table.itemOrder),
    index("quotation_items_quotation_id_idx").on(table.quotationId)
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

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull().unique(),
    password: text("password").notNull(),
    name: text("name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email)
  ]
);

export const catalogSuppliers = pgTable(
  "catalog_suppliers",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    document: text("document"),
    contactName: text("contact_name"),
    phone: text("phone"),
    email: text("email"),
    city: text("city"),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("catalog_suppliers_document_idx").on(table.document),
    index("catalog_suppliers_name_idx").on(table.name)
  ]
);

export const catalogItems = pgTable(
  "catalog_items",
  {
    id: serial("id").primaryKey(),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => catalogSuppliers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    unit: text("unit").notNull(),
    unitPrice: doublePrecision("unit_price").notNull(),
    notes: text("notes"),
    lastPriceAt: timestamp("last_price_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("catalog_items_supplier_item_unique").on(table.supplierId, table.normalizedName, table.unit),
    index("catalog_items_supplier_id_idx").on(table.supplierId),
    index("catalog_items_normalized_name_idx").on(table.normalizedName)
  ]
);


export const referenceProducts = pgTable(
  "reference_products",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    ean: text("ean"),
    brand: text("brand"),
    department: text("department"),
    packaging: text("packaging"),
    url: text("url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("reference_products_source_external_unique").on(table.source, table.externalId),
    index("reference_products_normalized_name_idx").on(table.normalizedName),
    index("reference_products_ean_idx").on(table.ean)
  ]
);

export const watchedQuotations = pgTable(
  "watched_quotations",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    quotationExternalId: text("quotation_external_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("watched_quotations_user_external_id_unique").on(table.userId, table.quotationExternalId),
    index("watched_quotations_user_idx").on(table.userId)
  ]
);


export const preQuotes = pgTable(
  "pre_quotes",
  {
    id: serial("id").primaryKey(),
    quotationExternalId: text("quotation_external_id").notNull(),
    orderId: text("order_id"),
    schoolName: text("school_name"),
    city: text("city"),
    expenseGroup: text("expense_group"),
    headline: text("headline"),
    marginPercent: doublePrecision("margin_percent").notNull().default(0),
    freightCost: doublePrecision("freight_cost").notNull().default(0),
    status: text("status").notNull().default("draft"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("pre_quotes_quotation_idx").on(table.quotationExternalId),
    index("pre_quotes_status_idx").on(table.status)
  ]
);

export const preQuoteItems = pgTable(
  "pre_quote_items",
  {
    id: serial("id").primaryKey(),
    preQuoteId: integer("pre_quote_id")
      .notNull()
      .references(() => preQuotes.id, { onDelete: "cascade" }),
    itemOrder: integer("item_order").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    unit: text("unit").notNull(),
    quantity: doublePrecision("quantity").notNull(),
    referenceValue: doublePrecision("reference_value"),
    supplierId: integer("supplier_id").references(() => catalogSuppliers.id, { onDelete: "set null" }),
    catalogItemId: integer("catalog_item_id").references(() => catalogItems.id, { onDelete: "set null" }),
    unitCost: doublePrecision("unit_cost"),
    totalCost: doublePrecision("total_cost"),
    source: text("source").notNull().default("none"),
    webTitle: text("web_title"),
    webPrice: doublePrecision("web_price"),
    webUrl: text("web_url"),
    webSearchedAt: timestamp("web_searched_at", { withTimezone: true }),
    notes: text("notes")
  },
  (table) => [
    uniqueIndex("pre_quote_items_quote_order_unique").on(table.preQuoteId, table.itemOrder),
    index("pre_quote_items_pre_quote_id_idx").on(table.preQuoteId)

  ]
);

export const notificationSubscriptions = pgTable(
  "notification_subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    city: text("city"),
    school: text("school"),
    keyword: text("keyword"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("notification_subscriptions_user_idx").on(table.userId),
    index("notification_subscriptions_category_idx").on(table.categoryId)
  ]
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    quotationId: integer("quotation_id")
      .notNull()
      .references(() => quotations.id, { onDelete: "cascade" }),
    read: boolean("read").notNull().default(false),
    emailedAt: timestamp("emailed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("notifications_user_quotation_unique").on(table.userId, table.quotationId),
    index("notifications_user_read_idx").on(table.userId, table.read)
  ]
);
