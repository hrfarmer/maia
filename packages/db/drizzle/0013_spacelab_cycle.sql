CREATE TABLE IF NOT EXISTS "spacelab_guild_cycle_state" (
	"guild_id" varchar(20) PRIMARY KEY NOT NULL,
	"last_cycle_at" timestamp with time zone,
	"last_error" text,
	"last_parsed_message_id" text,
	"pending_archive_message_ids_json" text DEFAULT '[]' NOT NULL,
	"adapt_links_revision" integer DEFAULT 0 NOT NULL,
	"last_processed_adapt_links_revision" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "spacelab_guild_cycle_state" ADD CONSTRAINT "spacelab_guild_cycle_state_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
