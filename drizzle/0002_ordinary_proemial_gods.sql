ALTER TABLE "schools" ALTER COLUMN "id_county" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "schools" ALTER COLUMN "city" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "headline" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "top_items" jsonb;--> statement-breakpoint
-- Caixa Escolar MG does not expose a generic deadline field; commercial deadline queries use delivery_date.
CREATE INDEX "opportunities_delivery_date_idx" ON "opportunities" USING btree ("delivery_date");
