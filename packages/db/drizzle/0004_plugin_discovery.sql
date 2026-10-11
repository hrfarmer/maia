CREATE TABLE IF NOT EXISTS "plugin_scans" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"trigger" varchar(32) NOT NULL,
	"scan_error" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "discovered_plugins" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"scan_id" varchar(36) NOT NULL,
	"directory_name" text NOT NULL,
	"status" varchar(16) NOT NULL,
	"plugin_id" text,
	"display_name" text,
	"lifetime" varchar(16),
	"subscribed_events" text,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bot_runtime_state" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"plugin_refresh_requested_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discovered_plugins" ADD CONSTRAINT "discovered_plugins_scan_id_plugin_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."plugin_scans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discovered_plugins_scan_id_idx" ON "discovered_plugins" USING btree ("scan_id");
--> statement-breakpoint
INSERT INTO "bot_runtime_state" ("id")
VALUES ('default')
ON CONFLICT ("id") DO NOTHING;
