CREATE TABLE IF NOT EXISTS "guilds" (
	"id" varchar(20) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guild_commands" (
	"guild_id" varchar(20) NOT NULL,
	"command_name" varchar(64) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "guild_commands_guild_id_command_name_pk" PRIMARY KEY("guild_id","command_name")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guild_commands" ADD CONSTRAINT "guild_commands_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
