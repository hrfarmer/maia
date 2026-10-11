CREATE TABLE IF NOT EXISTS "spacelab_guild_roster_state" (
	"guild_id" varchar(20) PRIMARY KEY NOT NULL,
	"rows_json" text NOT NULL,
	"adapt_values_json" text NOT NULL,
	"parsed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "spacelab_adapt_role_links" (
	"guild_id" varchar(20) NOT NULL,
	"adapt_value" text NOT NULL,
	"discord_role_id" text NOT NULL,
	CONSTRAINT "spacelab_adapt_role_links_guild_id_adapt_value_pk" PRIMARY KEY("guild_id","adapt_value")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "spacelab_guild_roster_state" ADD CONSTRAINT "spacelab_guild_roster_state_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "spacelab_adapt_role_links" ADD CONSTRAINT "spacelab_adapt_role_links_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
