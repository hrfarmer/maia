import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const guilds = pgTable("guilds", {
  id: varchar("id", { length: 20 }).primaryKey(),
  name: text("name").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  leftAt: timestamp("left_at", { withTimezone: true }),
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

export const guildsRelations = relations(guilds, ({ many }) => ({
  guildCommands: many(guildCommands),
  guildApiKeys: many(guildApiKeys),
  auditLogs: many(auditLogs),
}));

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

export type AuditSource = "command" | "dashboard" | "api";

export type AuditAction =
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
  | "member.nickname";
