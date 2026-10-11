ALTER TABLE "guild_plugin_settings" ADD COLUMN IF NOT EXISTS "cron_expression" text;
--> statement-breakpoint
ALTER TABLE "plugin_run_requests" ADD COLUMN IF NOT EXISTS "trigger" varchar(16) DEFAULT 'run_now' NOT NULL;
