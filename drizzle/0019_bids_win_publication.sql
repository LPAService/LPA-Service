ALTER TABLE "bids" ADD COLUMN "our_supplier_id" integer;
--> statement-breakpoint
ALTER TABLE "bids" ADD COLUMN "win_publication_id" text;
--> statement-breakpoint
ALTER TABLE "bids" ADD COLUMN "win_publication_json" jsonb;
--> statement-breakpoint
UPDATE "bids"
   SET "our_supplier_id" = CASE
     WHEN "quotations"."raw_json" #>> '{listing,idSupplier}' ~ '^[0-9]+$'
     THEN ("quotations"."raw_json" #>> '{listing,idSupplier}')::integer
     ELSE NULL
   END
  FROM "quotations"
 WHERE "bids"."quotation_external_id" = "quotations"."external_id"
   AND "bids"."our_supplier_id" IS NULL;
--> statement-breakpoint
CREATE INDEX "bids_our_supplier_id_idx" ON "bids" USING btree ("our_supplier_id");
--> statement-breakpoint
CREATE INDEX "bids_win_publication_id_idx" ON "bids" USING btree ("win_publication_id");
