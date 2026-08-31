CREATE TABLE "reference_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"ean" text,
	"brand" text,
	"department" text,
	"packaging" text,
	"url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "reference_products_source_external_unique" ON "reference_products" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "reference_products_normalized_name_idx" ON "reference_products" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "reference_products_ean_idx" ON "reference_products" USING btree ("ean");