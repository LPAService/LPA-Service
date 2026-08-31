CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reference_products_normalized_name_trgm_idx" ON "reference_products" USING gin ("normalized_name" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reference_products_search_vector_idx" ON "reference_products" USING gin (to_tsvector('portuguese', "normalized_name"));
