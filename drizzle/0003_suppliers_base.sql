CREATE TABLE "suppliers" (
  "id" serial PRIMARY KEY NOT NULL,
  "document" text NOT NULL,
  "name" text NOT NULL,
  "normalized_name" text NOT NULL,
  "city" text,
  "first_seen_at" timestamp with time zone,
  "last_seen_at" timestamp with time zone,
  "total_orders" integer DEFAULT 0 NOT NULL,
  "total_value" double precision DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_products" (
  "id" serial PRIMARY KEY NOT NULL,
  "supplier_id" integer NOT NULL,
  "product_name" text NOT NULL,
  "normalized_product_name" text NOT NULL,
  "category_id" integer,
  "times_supplied" integer DEFAULT 0 NOT NULL,
  "total_quantity" double precision DEFAULT 0 NOT NULL,
  "avg_unit_value" double precision,
  "min_unit_value" double precision,
  "max_unit_value" double precision,
  "last_supplied_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "supplier_categories" (
  "id" serial PRIMARY KEY NOT NULL,
  "supplier_id" integer NOT NULL,
  "category_id" integer NOT NULL,
  "order_count" integer DEFAULT 0 NOT NULL,
  "total_value" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");
--> statement-breakpoint
ALTER TABLE "supplier_categories" ADD CONSTRAINT "supplier_categories_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "supplier_categories" ADD CONSTRAINT "supplier_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");
--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_document_unique" ON "suppliers" USING btree ("document");
--> statement-breakpoint
CREATE INDEX "suppliers_city_idx" ON "suppliers" USING btree ("city");
--> statement-breakpoint
CREATE INDEX "suppliers_normalized_name_idx" ON "suppliers" USING btree ("normalized_name");
--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_products_supplier_product_unique" ON "supplier_products" USING btree ("supplier_id", "normalized_product_name");
--> statement-breakpoint
CREATE INDEX "supplier_products_category_id_idx" ON "supplier_products" USING btree ("category_id");
--> statement-breakpoint
CREATE INDEX "supplier_products_product_name_idx" ON "supplier_products" USING btree ("normalized_product_name");
--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_categories_supplier_category_unique" ON "supplier_categories" USING btree ("supplier_id", "category_id");
--> statement-breakpoint
CREATE INDEX "supplier_categories_category_id_idx" ON "supplier_categories" USING btree ("category_id");
