ALTER TABLE "quotations" ADD COLUMN "proposal_blocked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "proposal_blocked_reason" text;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "proposal_blocked_item_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "proposal_suspect" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "proposal_suspect_item_count" integer DEFAULT 0 NOT NULL;