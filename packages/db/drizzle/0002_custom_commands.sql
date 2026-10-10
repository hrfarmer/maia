ALTER TABLE "guilds" ADD COLUMN "custom_command_sync_error" text;
--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "custom_command_synced_at" timestamp with time zone;
--> statement-breakpoint
CREATE TABLE "guild_custom_commands" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"guild_id" varchar(20) NOT NULL,
	"name" varchar(32) NOT NULL,
	"description" varchar(100) NOT NULL,
	"response_text" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guild_custom_commands" ADD CONSTRAINT "guild_custom_commands_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "guild_custom_commands_guild_name_idx" ON "guild_custom_commands" USING btree ("guild_id","name");
--> statement-breakpoint
CREATE INDEX "guild_custom_commands_guild_id_idx" ON "guild_custom_commands" USING btree ("guild_id");
