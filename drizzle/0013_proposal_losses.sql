CREATE TABLE "proposal_losses" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"id_subprogram" integer NOT NULL,
	"id_school" integer NOT NULL,
	"id_budget" integer NOT NULL,
	"school_name" text NOT NULL,
	"county_name" text,
	"expense_group" text NOT NULL,
	"proposal_deadline" timestamp with time zone,
	"our_supplier_id" integer NOT NULL,
	"our_total" numeric(14, 2) NOT NULL,
	"winner_supplier_id" integer NOT NULL,
	"winner_name" text,
	"winner_total" numeric(14, 2),
	"competitor_count" integer NOT NULL,
	"our_rank" integer,
	"estimated_value" numeric(14, 2),
	"raw_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_losses_order_id_unique" ON "proposal_losses" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "proposal_losses_expense_group_idx" ON "proposal_losses" USING btree ("expense_group");--> statement-breakpoint
CREATE INDEX "proposal_losses_proposal_deadline_idx" ON "proposal_losses" USING btree ("proposal_deadline");
