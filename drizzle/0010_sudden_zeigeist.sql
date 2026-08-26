CREATE TABLE "watched_quotations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"quotation_external_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "watched_quotations" ADD CONSTRAINT "watched_quotations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "watched_quotations_user_external_id_unique" ON "watched_quotations" USING btree ("user_id","quotation_external_id");--> statement-breakpoint
CREATE INDEX "watched_quotations_user_idx" ON "watched_quotations" USING btree ("user_id");