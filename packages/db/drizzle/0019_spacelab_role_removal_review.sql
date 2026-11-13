CREATE TABLE IF NOT EXISTS "spacelab_role_removal_flags" (
	"guild_id" varchar(20) NOT NULL,
	"discord_user_id" text NOT NULL,
	"discord_handle" text NOT NULL,
	"role_ids_json" text NOT NULL,
	"flagged_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spacelab_role_removal_flags_guild_id_discord_user_id_pk" PRIMARY KEY("guild_id","discord_user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "spacelab_role_removal_ignores" (
	"guild_id" varchar(20) NOT NULL,
	"discord_user_id" text NOT NULL,
	"discord_handle" text NOT NULL,
	"ignored_until" timestamp with time zone,
	CONSTRAINT "spacelab_role_removal_ignores_guild_id_discord_user_id_pk" PRIMARY KEY("guild_id","discord_user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "spacelab_role_removal_flags" ADD CONSTRAINT "spacelab_role_removal_flags_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "spacelab_role_removal_ignores" ADD CONSTRAINT "spacelab_role_removal_ignores_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
