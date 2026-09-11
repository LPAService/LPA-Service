ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "no_longer_listed_at" timestamp with time zone;
CREATE INDEX IF NOT EXISTS "quotations_no_longer_listed_idx" ON "quotations" ("no_longer_listed_at");
