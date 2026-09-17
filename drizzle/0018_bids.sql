CREATE TABLE "bids" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotation_external_id" text NOT NULL,
	"order_id" text NOT NULL,
	"pre_quote_id" integer,
	"our_total" numeric(14, 2),
	"margin_percent" double precision,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"proposal_deadline" timestamp with time zone,
	"expense_group" text NOT NULL,
	"county_name" text,
	"outcome" text DEFAULT 'pendente' NOT NULL,
	"outcome_at" timestamp with time zone,
	"loss_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bids_outcome_check" CHECK ("outcome" IN ('pendente', 'ganho', 'perdido', 'cancelado', 'sem_resultado'))
);
--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_quotation_external_id_quotations_external_id_fk" FOREIGN KEY ("quotation_external_id") REFERENCES "public"."quotations"("external_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_pre_quote_id_pre_quotes_id_fk" FOREIGN KEY ("pre_quote_id") REFERENCES "public"."pre_quotes"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_loss_id_proposal_losses_id_fk" FOREIGN KEY ("loss_id") REFERENCES "public"."proposal_losses"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "bids_quotation_external_id_unique" ON "bids" USING btree ("quotation_external_id");
--> statement-breakpoint
CREATE INDEX "bids_order_id_idx" ON "bids" USING btree ("order_id");
--> statement-breakpoint
CREATE INDEX "bids_outcome_idx" ON "bids" USING btree ("outcome");
--> statement-breakpoint
CREATE INDEX "bids_proposal_deadline_idx" ON "bids" USING btree ("proposal_deadline");
