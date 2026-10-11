CREATE TABLE IF NOT EXISTS "plugin_guild_config_notifications" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"plugin_id" text NOT NULL,
	"guild_id" varchar(20) NOT NULL,
	"change_type" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plugin_guild_config_notifications_pending_idx" ON "plugin_guild_config_notifications" ("delivered_at","created_at");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plugin_guild_config_notifications" ADD CONSTRAINT "plugin_guild_config_notifications_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
