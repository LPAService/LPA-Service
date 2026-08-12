CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" integer,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"found" integer DEFAULT 0 NOT NULL,
	"new_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"log" text
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" serial PRIMARY KEY NOT NULL,
	"opportunity_id" integer NOT NULL,
	"name_raw" text,
	"name_normalized" text,
	"qty" integer,
	"unit" text
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" text NOT NULL,
	"source_url" text NOT NULL,
	"school_name" text,
	"city" text,
	"title_original" text,
	"title_normalized" text,
	"description_raw" text,
	"summary" text,
	"category_id" integer,
	"deadline" timestamp with time zone,
	"status" text DEFAULT 'open' NOT NULL,
	"published_at" timestamp with time zone,
	"raw_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunities_external_id_unique" ON "opportunities" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "opportunities_external_id_idx" ON "opportunities" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "opportunities_city_idx" ON "opportunities" USING btree ("city");--> statement-breakpoint
CREATE INDEX "opportunities_category_id_idx" ON "opportunities" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "opportunities_deadline_idx" ON "opportunities" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX "opportunities_status_idx" ON "opportunities" USING btree ("status");