CREATE TABLE "quotation_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotation_id" integer NOT NULL,
	"item_order" integer NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"unit" text NOT NULL,
	"quantity" double precision NOT NULL,
	"reference_value" double precision,
	"raw_json" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotations" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" text NOT NULL,
	"nu_budget_order" text,
	"id_subprogram" integer NOT NULL,
	"id_school" integer NOT NULL,
	"id_budget" integer NOT NULL,
	"id_county" integer,
	"county_name" text,
	"school_name" text NOT NULL,
	"expense_group" text NOT NULL,
	"category_id" integer,
	"headline" text NOT NULL,
	"summary" text NOT NULL,
	"top_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"proposal_deadline" timestamp with time zone,
	"delivery_date" timestamp with time zone,
	"item_count" integer DEFAULT 0 NOT NULL,
	"total_reference_value" double precision,
	"budget_status" text,
	"supplier_status" text,
	"proposal_url" text NOT NULL,
	"raw_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quotation_items_quotation_order_unique" ON "quotation_items" USING btree ("quotation_id","item_order");--> statement-breakpoint
CREATE INDEX "quotation_items_quotation_id_idx" ON "quotation_items" USING btree ("quotation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotations_external_id_unique" ON "quotations" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "quotations_natural_key_idx" ON "quotations" USING btree ("id_subprogram","id_school","id_budget");--> statement-breakpoint
CREATE INDEX "quotations_county_idx" ON "quotations" USING btree ("id_county");--> statement-breakpoint
CREATE INDEX "quotations_school_idx" ON "quotations" USING btree ("id_school");--> statement-breakpoint
CREATE INDEX "quotations_expense_group_idx" ON "quotations" USING btree ("expense_group");--> statement-breakpoint
CREATE INDEX "quotations_category_id_idx" ON "quotations" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "quotations_proposal_deadline_idx" ON "quotations" USING btree ("proposal_deadline");--> statement-breakpoint
CREATE INDEX "quotations_supplier_status_idx" ON "quotations" USING btree ("supplier_status");
