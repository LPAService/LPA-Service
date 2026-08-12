CREATE TABLE "attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"opportunity_id" integer NOT NULL,
	"external_attachment_id" integer NOT NULL,
	"filename" text NOT NULL,
	"thumb_url" text NOT NULL,
	"url" text,
	"raw_json" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id_school" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"id_county" integer NOT NULL,
	"city" text NOT NULL,
	"regional" text,
	"raw_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "items_opportunity_id_opportunities_id_fk";
--> statement-breakpoint
DROP INDEX "opportunities_external_id_idx";--> statement-breakpoint
DROP INDEX "opportunities_deadline_idx";--> statement-breakpoint
DROP INDEX "opportunities_status_idx";--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "unit" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_runs" ADD COLUMN "mode" text NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_runs" ADD COLUMN "updated_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_runs" ADD COLUMN "errors" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "item_order" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "description" text NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "quantity" double precision NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "unit_value" double precision;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "total_value" double precision;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "is_permanent" boolean NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "expense_category" text NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "raw_json" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "order_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "id_subprogram" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "id_school" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "id_budget" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "id_supplier" integer;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "school" text NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "regional" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "expense_group" text NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "subprogram" text NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "year" text NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "purchase_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "proposal_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "delivery_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "purchase_order_status" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "accountability_status" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "accountability_sent" boolean;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "supplier_name" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "supplier_document" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "initiative_description" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "total_value" double precision;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "item_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attachments_opportunity_external_unique" ON "attachments" USING btree ("opportunity_id","external_attachment_id");--> statement-breakpoint
CREATE INDEX "attachments_opportunity_id_idx" ON "attachments" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "schools_city_idx" ON "schools" USING btree ("city");--> statement-breakpoint
CREATE INDEX "schools_regional_idx" ON "schools" USING btree ("regional");--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_id_school_schools_id_school_fk" FOREIGN KEY ("id_school") REFERENCES "public"."schools"("id_school") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_runs_started_at_idx" ON "collection_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "collection_runs_status_idx" ON "collection_runs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "items_opportunity_order_unique" ON "items" USING btree ("opportunity_id","item_order");--> statement-breakpoint
CREATE INDEX "items_opportunity_id_idx" ON "items" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "opportunities_natural_key_idx" ON "opportunities" USING btree ("id_subprogram","id_school","id_budget");--> statement-breakpoint
CREATE INDEX "opportunities_order_id_idx" ON "opportunities" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "opportunities_school_idx" ON "opportunities" USING btree ("id_school");--> statement-breakpoint
CREATE INDEX "opportunities_regional_idx" ON "opportunities" USING btree ("regional");--> statement-breakpoint
CREATE INDEX "opportunities_expense_group_idx" ON "opportunities" USING btree ("expense_group");--> statement-breakpoint
CREATE INDEX "opportunities_purchase_date_idx" ON "opportunities" USING btree ("purchase_date");--> statement-breakpoint
CREATE INDEX "opportunities_purchase_status_idx" ON "opportunities" USING btree ("purchase_order_status");--> statement-breakpoint
CREATE INDEX "opportunities_accountability_status_idx" ON "opportunities" USING btree ("accountability_status");--> statement-breakpoint
ALTER TABLE "collection_runs" DROP COLUMN "log";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "name_raw";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "name_normalized";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "qty";--> statement-breakpoint
ALTER TABLE "opportunities" DROP COLUMN "school_name";--> statement-breakpoint
ALTER TABLE "opportunities" DROP COLUMN "title_original";--> statement-breakpoint
ALTER TABLE "opportunities" DROP COLUMN "title_normalized";--> statement-breakpoint
ALTER TABLE "opportunities" DROP COLUMN "description_raw";--> statement-breakpoint
ALTER TABLE "opportunities" DROP COLUMN "summary";--> statement-breakpoint
ALTER TABLE "opportunities" DROP COLUMN "deadline";--> statement-breakpoint
ALTER TABLE "opportunities" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "opportunities" DROP COLUMN "published_at";