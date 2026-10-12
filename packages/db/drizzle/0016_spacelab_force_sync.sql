ALTER TABLE "spacelab_guild_adapt_settings" ADD COLUMN IF NOT EXISTS "force_sync_pending" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "spacelab_guild_adapt_settings" ADD COLUMN IF NOT EXISTS "last_force_sync_requested_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "spacelab_guild_adapt_settings" ADD COLUMN IF NOT EXISTS "last_force_sync_completed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "spacelab_guild_adapt_settings" ADD COLUMN IF NOT EXISTS "last_force_sync_ok" boolean;
--> statement-breakpoint
ALTER TABLE "spacelab_guild_adapt_settings" ADD COLUMN IF NOT EXISTS "last_force_sync_error" text;
