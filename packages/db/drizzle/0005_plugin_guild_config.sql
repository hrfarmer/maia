ALTER TABLE "discovered_plugins" ADD COLUMN IF NOT EXISTS "command_json" text;
--> statement-breakpoint
ALTER TABLE "discovered_plugins" ADD COLUMN IF NOT EXISTS "environment_json" text;
--> statement-breakpoint
ALTER TABLE "discovered_plugins" ADD COLUMN IF NOT EXISTS "invocation_time_limit_ms" integer;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guild_plugin_settings" (
	"guild_id" varchar(20) NOT NULL,
	"plugin_id" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	CONSTRAINT "guild_plugin_settings_guild_id_plugin_id_pk" PRIMARY KEY("guild_id","plugin_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guild_plugin_env_values" (
	"guild_id" varchar(20) NOT NULL,
	"plugin_id" text NOT NULL,
	"env_key" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "guild_plugin_env_values_guild_id_plugin_id_env_key_pk" PRIMARY KEY("guild_id","plugin_id","env_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plugin_run_requests" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"guild_id" varchar(20) NOT NULL,
	"plugin_id" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guild_plugin_settings" ADD CONSTRAINT "guild_plugin_settings_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guild_plugin_env_values" ADD CONSTRAINT "guild_plugin_env_values_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plugin_run_requests" ADD CONSTRAINT "plugin_run_requests_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plugin_run_requests_pending_idx" ON "plugin_run_requests" USING btree ("requested_at") WHERE "started_at" IS NULL;
