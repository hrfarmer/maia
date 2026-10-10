CREATE TABLE "guild_api_keys" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"guild_id" varchar(20) NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "guild_api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"guild_id" varchar(20) NOT NULL,
	"source" varchar(32) NOT NULL,
	"actor_id" text NOT NULL,
	"actor_label" text,
	"action" varchar(64) NOT NULL,
	"target_type" varchar(32) NOT NULL,
	"target_id" text NOT NULL,
	"detail" text,
	"success" boolean NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guild_api_keys" ADD CONSTRAINT "guild_api_keys_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guild_api_keys_guild_id_idx" ON "guild_api_keys" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "audit_logs_guild_created_idx" ON "audit_logs" USING btree ("guild_id","created_at");
