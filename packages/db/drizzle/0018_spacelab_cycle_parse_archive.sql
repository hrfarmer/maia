ALTER TABLE "spacelab_guild_cycle_state" ADD COLUMN IF NOT EXISTS "last_failed_parse_message_id" text;
--> statement-breakpoint
ALTER TABLE "spacelab_guild_cycle_state" ADD COLUMN IF NOT EXISTS "last_failed_parse_received_at" text;
--> statement-breakpoint
ALTER TABLE "spacelab_guild_cycle_state" ADD COLUMN IF NOT EXISTS "pending_archive_attempts_json" text DEFAULT '{}' NOT NULL;
