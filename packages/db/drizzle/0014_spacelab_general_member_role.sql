CREATE TABLE IF NOT EXISTS "spacelab_guild_adapt_settings" (
	"guild_id" varchar(20) PRIMARY KEY NOT NULL,
	"general_member_role_id" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "spacelab_guild_adapt_settings" ADD CONSTRAINT "spacelab_guild_adapt_settings_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
