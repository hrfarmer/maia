import { and, asc, eq } from "drizzle-orm";
import type { Db } from "./client.js";
import { guildCustomCommands, guilds } from "./schema.js";

export interface CustomCommandRecord {
  id: string;
  guildId: string;
  name: string;
  description: string;
  responseText: string;
  enabled: boolean;
  ephemeral: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomCommandSyncStatus {
  syncedAt: Date | null;
  syncError: string | null;
}

export interface CreateCustomCommandInput {
  name: string;
  description: string;
  responseText: string;
  enabled?: boolean;
  ephemeral?: boolean;
}

export interface UpdateCustomCommandInput {
  name?: string;
  description?: string;
  responseText?: string;
  enabled?: boolean;
  ephemeral?: boolean;
}

export async function listGuildCustomCommands(
  db: Db,
  guildId: string,
): Promise<CustomCommandRecord[]> {
  return db.query.guildCustomCommands.findMany({
    where: eq(guildCustomCommands.guildId, guildId),
    orderBy: [asc(guildCustomCommands.name)],
  });
}

export async function getGuildCustomCommandById(
  db: Db,
  guildId: string,
  commandId: string,
) {
  return db.query.guildCustomCommands.findFirst({
    where: and(
      eq(guildCustomCommands.guildId, guildId),
      eq(guildCustomCommands.id, commandId),
    ),
  });
}

export async function getEnabledCustomCommandByName(
  db: Db,
  guildId: string,
  name: string,
) {
  return db.query.guildCustomCommands.findFirst({
    where: and(
      eq(guildCustomCommands.guildId, guildId),
      eq(guildCustomCommands.name, name),
      eq(guildCustomCommands.enabled, true),
    ),
  });
}

export async function createGuildCustomCommand(
  db: Db,
  guildId: string,
  input: CreateCustomCommandInput,
): Promise<CustomCommandRecord> {
  const id = crypto.randomUUID();
  const now = new Date();
  const [row] = await db
    .insert(guildCustomCommands)
    .values({
      id,
      guildId,
      name: input.name,
      description: input.description,
      responseText: input.responseText,
      enabled: input.enabled ?? true,
      ephemeral: input.ephemeral ?? false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("Failed to create custom command");
  }
  return row;
}

export async function updateGuildCustomCommand(
  db: Db,
  guildId: string,
  commandId: string,
  input: UpdateCustomCommandInput,
): Promise<CustomCommandRecord | null> {
  const patch: Partial<typeof guildCustomCommands.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.name !== undefined) {
    patch.name = input.name;
  }
  if (input.description !== undefined) {
    patch.description = input.description;
  }
  if (input.responseText !== undefined) {
    patch.responseText = input.responseText;
  }
  if (input.enabled !== undefined) {
    patch.enabled = input.enabled;
  }
  if (input.ephemeral !== undefined) {
    patch.ephemeral = input.ephemeral;
  }

  const [row] = await db
    .update(guildCustomCommands)
    .set(patch)
    .where(
      and(
        eq(guildCustomCommands.guildId, guildId),
        eq(guildCustomCommands.id, commandId),
      ),
    )
    .returning();
  return row ?? null;
}

export async function deleteGuildCustomCommand(
  db: Db,
  guildId: string,
  commandId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(guildCustomCommands)
    .where(
      and(
        eq(guildCustomCommands.guildId, guildId),
        eq(guildCustomCommands.id, commandId),
      ),
    )
    .returning({ id: guildCustomCommands.id });
  return deleted.length > 0;
}

export async function listEnabledCustomCommandsForSync(
  db: Db,
  guildId: string,
): Promise<Array<{ name: string; description: string }>> {
  const rows = await db.query.guildCustomCommands.findMany({
    where: and(
      eq(guildCustomCommands.guildId, guildId),
      eq(guildCustomCommands.enabled, true),
    ),
    columns: { name: true, description: true },
    orderBy: [asc(guildCustomCommands.name)],
  });
  return rows;
}

export async function getCustomCommandSyncStatus(
  db: Db,
  guildId: string,
): Promise<CustomCommandSyncStatus> {
  const row = await db.query.guilds.findFirst({
    where: eq(guilds.id, guildId),
    columns: {
      customCommandSyncedAt: true,
      customCommandSyncError: true,
    },
  });
  return {
    syncedAt: row?.customCommandSyncedAt ?? null,
    syncError: row?.customCommandSyncError ?? null,
  };
}

export async function recordCustomCommandSyncSuccess(db: Db, guildId: string) {
  await db
    .update(guilds)
    .set({
      customCommandSyncedAt: new Date(),
      customCommandSyncError: null,
    })
    .where(eq(guilds.id, guildId));
}

export async function recordCustomCommandSyncFailure(
  db: Db,
  guildId: string,
  message: string,
) {
  await db
    .update(guilds)
    .set({
      customCommandSyncError: message.slice(0, 2000),
    })
    .where(eq(guilds.id, guildId));
}
