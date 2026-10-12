ALTER TABLE "spacelab_remembered_members" ADD COLUMN IF NOT EXISTS "granted_role_ids_json" text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE "spacelab_guild_adapt_settings" ADD COLUMN IF NOT EXISTS "last_applied_links_json" text DEFAULT '{}' NOT NULL;
--> statement-breakpoint
ALTER TABLE "spacelab_guild_adapt_settings" ADD COLUMN IF NOT EXISTS "last_applied_general_member_role_id" text;
