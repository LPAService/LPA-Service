CREATE TABLE "catalog_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"unit" text NOT NULL,
	"unit_price" double precision NOT NULL,
	"notes" text,
	"last_price_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"document" text,
	"contact_name" text,
	"phone" text,
	"email" text,
	"city" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pre_quote_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"pre_quote_id" integer NOT NULL,
	"item_order" integer NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"unit" text NOT NULL,
	"quantity" double precision NOT NULL,
	"reference_value" double precision,
	"supplier_id" integer,
	"catalog_item_id" integer,
	"unit_cost" double precision,
	"total_cost" double precision,
	"source" text DEFAULT 'none' NOT NULL,
	"web_title" text,
	"web_price" double precision,
	"web_url" text,
	"web_searched_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "pre_quotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotation_external_id" text NOT NULL,
	"order_id" text,
	"school_name" text,
	"city" text,
	"expense_group" text,
	"headline" text,
	"margin_percent" double precision DEFAULT 0 NOT NULL,
	"freight_cost" double precision DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_supplier_id_catalog_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."catalog_suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_quote_items" ADD CONSTRAINT "pre_quote_items_pre_quote_id_pre_quotes_id_fk" FOREIGN KEY ("pre_quote_id") REFERENCES "public"."pre_quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_quote_items" ADD CONSTRAINT "pre_quote_items_supplier_id_catalog_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."catalog_suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_quote_items" ADD CONSTRAINT "pre_quote_items_catalog_item_id_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_items_supplier_item_unique" ON "catalog_items" USING btree ("supplier_id","normalized_name","unit");--> statement-breakpoint
CREATE INDEX "catalog_items_supplier_id_idx" ON "catalog_items" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "catalog_items_normalized_name_idx" ON "catalog_items" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "catalog_suppliers_document_idx" ON "catalog_suppliers" USING btree ("document");--> statement-breakpoint
CREATE INDEX "catalog_suppliers_name_idx" ON "catalog_suppliers" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "pre_quote_items_quote_order_unique" ON "pre_quote_items" USING btree ("pre_quote_id","item_order");--> statement-breakpoint
CREATE INDEX "pre_quote_items_pre_quote_id_idx" ON "pre_quote_items" USING btree ("pre_quote_id");--> statement-breakpoint
CREATE INDEX "pre_quotes_quotation_idx" ON "pre_quotes" USING btree ("quotation_external_id");--> statement-breakpoint
CREATE INDEX "pre_quotes_status_idx" ON "pre_quotes" USING btree ("status");