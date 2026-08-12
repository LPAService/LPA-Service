import {
  boolean,
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

export const opportunities = pgTable(
  "opportunities",
  {
    id: serial("id").primaryKey(),
    externalId: text("external_id").notNull(),
    sourceUrl: text("source_url").notNull(),
    schoolName: text("school_name"),
    city: text("city"),
    titleOriginal: text("title_original"),
    titleNormalized: text("title_normalized"),
    descriptionRaw: text("description_raw"),
    summary: text("summary"),
    categoryId: integer("category_id").references(() => categories.id),
    deadline: timestamp("deadline", { withTimezone: true }),
    status: text("status").notNull().default("open"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    rawJson: jsonb("raw_json").notNull().default({}),
    collectedAt: timestamp("collected_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("opportunities_external_id_unique").on(table.externalId),
    index("opportunities_external_id_idx").on(table.externalId),
    index("opportunities_city_idx").on(table.city),
    index("opportunities_category_id_idx").on(table.categoryId),
    index("opportunities_deadline_idx").on(table.deadline),
    index("opportunities_status_idx").on(table.status)
  ]
);

export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  opportunityId: integer("opportunity_id")
    .notNull()
    .references(() => opportunities.id),
  nameRaw: text("name_raw"),
  nameNormalized: text("name_normalized"),
  qty: integer("qty"),
  unit: text("unit")
});

export const collectionRuns = pgTable("collection_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").notNull().default("running"),
  found: integer("found").notNull().default(0),
  newCount: integer("new_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  log: text("log")
});

