CREATE INDEX "users_email_search_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_name_search_idx" ON "users" USING btree ("name");--> statement-breakpoint
CREATE INDEX "users_created_order_idx" ON "users" USING btree ("createdAt","id");