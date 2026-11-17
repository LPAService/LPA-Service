CREATE TABLE "user_school_favorites" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"id_school" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_school_favorites" ADD CONSTRAINT "user_school_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_school_favorites" ADD CONSTRAINT "user_school_favorites_id_school_schools_id_school_fk" FOREIGN KEY ("id_school") REFERENCES "public"."schools"("id_school") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "user_school_favorites_user_school_unique" ON "user_school_favorites" USING btree ("user_id","id_school");
--> statement-breakpoint
CREATE INDEX "user_school_favorites_school_idx" ON "user_school_favorites" USING btree ("id_school");
