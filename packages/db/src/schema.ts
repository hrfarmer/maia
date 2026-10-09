import { relations } from "drizzle-orm";
import {
  boolean,
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

export const guildsRelations = relations(guilds, ({ many }) => ({
  guildCommands: many(guildCommands),
}));

export const guildCommandsRelations = relations(guildCommands, ({ one }) => ({
  guild: one(guilds, {
    fields: [guildCommands.guildId],
    references: [guilds.id],
  }),
}));

export const DEFAULT_COMMANDS = ["hello"] as const;
