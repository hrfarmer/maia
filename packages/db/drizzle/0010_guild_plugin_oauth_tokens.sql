CREATE TABLE IF NOT EXISTS "guild_plugin_oauth_tokens" (
  "guild_id" varchar(20) NOT NULL,
  "plugin_id" text NOT NULL,
  "encrypted_refresh_token" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "guild_plugin_oauth_tokens_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "guild_plugin_oauth_tokens_guild_id_plugin_id_pk" PRIMARY KEY("guild_id","plugin_id")
);
