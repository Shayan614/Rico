ALTER TABLE "mandates" ADD COLUMN "owner_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "mandates" ADD CONSTRAINT "mandates_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mandates_owner_id_idx" ON "mandates" USING btree ("owner_id");