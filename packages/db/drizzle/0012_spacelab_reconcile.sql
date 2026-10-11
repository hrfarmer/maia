CREATE TABLE IF NOT EXISTS "spacelab_remembered_members" (
	"guild_id" varchar(20) NOT NULL,
	"discord_user_id" text NOT NULL,
	"discord_handle" text NOT NULL,
	CONSTRAINT "spacelab_remembered_members_guild_id_discord_user_id_pk" PRIMARY KEY("guild_id","discord_user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "spacelab_reconcile_failures" (
	"guild_id" varchar(20) NOT NULL,
	"member_key" text NOT NULL,
	"discord_handle" text NOT NULL,
	"attempts" integer NOT NULL,
	CONSTRAINT "spacelab_reconcile_failures_guild_id_member_key_pk" PRIMARY KEY("guild_id","member_key")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "spacelab_remembered_members" ADD CONSTRAINT "spacelab_remembered_members_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "spacelab_reconcile_failures" ADD CONSTRAINT "spacelab_reconcile_failures_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
