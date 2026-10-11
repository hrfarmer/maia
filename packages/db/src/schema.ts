import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const guilds = pgTable("guilds", {
  id: varchar("id", { length: 20 }).primaryKey(),
  name: text("name").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  leftAt: timestamp("left_at", { withTimezone: true }),
  customCommandSyncError: text("custom_command_sync_error"),
  customCommandSyncedAt: timestamp("custom_command_synced_at", {
    withTimezone: true,
  }),
});

export const guildCommands = pgTable(
  "guild_commands",
  {
    guildId: varchar("guild_id", { length: 20 })
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    commandName: varchar("command_name", { length: 64 }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.commandName] })],
);

export const guildCustomCommands = pgTable(
  "guild_custom_commands",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    guildId: varchar("guild_id", { length: 20 })
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 32 }).notNull(),
    description: varchar("description", { length: 100 }).notNull(),
    /** Plain-text reply for now; room for structured payloads later. */
    responseText: text("response_text").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    ephemeral: boolean("ephemeral").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("guild_custom_commands_guild_name_idx").on(
      table.guildId,
      table.name,
    ),
    index("guild_custom_commands_guild_id_idx").on(table.guildId),
  ],
);

export const guildApiKeys = pgTable(
  "guild_api_keys",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    guildId: varchar("guild_id", { length: 20 })
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [index("guild_api_keys_guild_id_idx").on(table.guildId)],
);

export const pluginScans = pgTable("plugin_scans", {
  id: varchar("id", { length: 36 }).primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  trigger: varchar("trigger", { length: 32 }).notNull(),
  scanError: text("scan_error"),
});

export const discoveredPlugins = pgTable(
  "discovered_plugins",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    scanId: varchar("scan_id", { length: 36 })
      .notNull()
      .references(() => pluginScans.id, { onDelete: "cascade" }),
    directoryName: text("directory_name").notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    pluginId: text("plugin_id"),
    displayName: text("display_name"),
    lifetime: varchar("lifetime", { length: 16 }),
    subscribedEvents: text("subscribed_events"),
    errorMessage: text("error_message"),
    commandJson: text("command_json"),
    environmentJson: text("environment_json"),
    invocationTimeLimitMs: integer("invocation_time_limit_ms"),
    maxConcurrentInvocations: integer("max_concurrent_invocations"),
    slashCommandsJson: text("slash_commands_json"),
  },
  (table) => [index("discovered_plugins_scan_id_idx").on(table.scanId)],
);

export const guildPluginSettings = pgTable(
  "guild_plugin_settings",
  {
    guildId: varchar("guild_id", { length: 20 })
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    pluginId: text("plugin_id").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    cronExpression: text("cron_expression"),
    slashCommandsEnabled: boolean("slash_commands_enabled")
      .notNull()
      .default(false),
    slashPublishError: text("slash_publish_error"),
    slashCollisionNotes: text("slash_collision_notes"),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.pluginId] })],
);

export const guildPluginEnvValues = pgTable(
  "guild_plugin_env_values",
  {
    guildId: varchar("guild_id", { length: 20 })
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    pluginId: text("plugin_id").notNull(),
    envKey: text("env_key").notNull(),
    value: text("value").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.guildId, table.pluginId, table.envKey],
    }),
  ],
);

export const pluginRunRequests = pgTable(
  "plugin_run_requests",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    guildId: varchar("guild_id", { length: 20 })
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    pluginId: text("plugin_id").notNull(),
    trigger: varchar("trigger", { length: 16 }).notNull().default("run_now"),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("plugin_run_requests_guild_plugin_idx").on(
      table.guildId,
      table.pluginId,
    ),
  ],
);

export const pluginGuildConfigNotifications = pgTable(
  "plugin_guild_config_notifications",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    pluginId: text("plugin_id").notNull(),
    guildId: varchar("guild_id", { length: 20 })
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    changeType: varchar("change_type", { length: 32 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  },
  (table) => [
    index("plugin_guild_config_notifications_pending_idx").on(
      table.deliveredAt,
      table.createdAt,
    ),
  ],
);

export const botRuntimeState = pgTable("bot_runtime_state", {
  id: varchar("id", { length: 32 }).primaryKey(),
  pluginRefreshRequestedAt: timestamp("plugin_refresh_requested_at", {
    withTimezone: true,
  }),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    guildId: varchar("guild_id", { length: 20 })
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    source: varchar("source", { length: 32 }).notNull(),
    actorId: text("actor_id").notNull(),
    actorLabel: text("actor_label"),
    action: varchar("action", { length: 64 }).notNull(),
    targetType: varchar("target_type", { length: 32 }).notNull(),
    targetId: text("target_id").notNull(),
    detail: text("detail"),
    success: boolean("success").notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_logs_guild_created_idx").on(table.guildId, table.createdAt),
  ],
);

export const pluginScansRelations = relations(pluginScans, ({ many }) => ({
  discoveredPlugins: many(discoveredPlugins),
}));

export const discoveredPluginsRelations = relations(
  discoveredPlugins,
  ({ one }) => ({
    scan: one(pluginScans, {
      fields: [discoveredPlugins.scanId],
      references: [pluginScans.id],
    }),
  }),
);

export const guildsRelations = relations(guilds, ({ many }) => ({
  guildCommands: many(guildCommands),
  guildCustomCommands: many(guildCustomCommands),
  guildApiKeys: many(guildApiKeys),
  auditLogs: many(auditLogs),
}));

export const guildCustomCommandsRelations = relations(
  guildCustomCommands,
  ({ one }) => ({
    guild: one(guilds, {
      fields: [guildCustomCommands.guildId],
      references: [guilds.id],
    }),
  }),
);

export const guildCommandsRelations = relations(guildCommands, ({ one }) => ({
  guild: one(guilds, {
    fields: [guildCommands.guildId],
    references: [guilds.id],
  }),
}));

export const guildApiKeysRelations = relations(guildApiKeys, ({ one }) => ({
  guild: one(guilds, {
    fields: [guildApiKeys.guildId],
    references: [guilds.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  guild: one(guilds, {
    fields: [auditLogs.guildId],
    references: [guilds.id],
  }),
}));

export const DEFAULT_COMMANDS = ["hello", "role", "member"] as const;

export type AuditSource = "command" | "dashboard" | "api" | "plugin";

export type AuditAction =
  | "plugin.run"
  | "role.add"
  | "role.remove"
  | "role.set"
  | "role.create"
  | "role.delete"
  | "role.update"
  | "member.kick"
  | "member.ban"
  | "member.unban"
  | "member.timeout"
  | "member.untimeout"
  | "member.nickname"
  | "custom_command.create"
  | "custom_command.update"
  | "custom_command.delete";

export type AuditTargetType =
  | "member"
  | "role"
  | "ban"
  | "custom_command"
  | "plugin";
