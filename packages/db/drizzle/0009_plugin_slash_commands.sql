ALTER TABLE "guild_plugin_settings" ADD COLUMN "slash_commands_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "guild_plugin_settings" ADD COLUMN "slash_publish_error" text;
ALTER TABLE "guild_plugin_settings" ADD COLUMN "slash_collision_notes" text;
ALTER TABLE "discovered_plugins" ADD COLUMN "slash_commands_json" text;
