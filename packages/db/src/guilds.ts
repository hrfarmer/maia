import { eq, isNull } from "drizzle-orm";
import type { Db } from "./client.js";
import { DEFAULT_COMMANDS, guildCommands, guilds } from "./schema.js";

export async function recordGuildJoin(db: Db, id: string, name: string) {
  const existing = await db.query.guilds.findFirst({
    where: eq(guilds.id, id),
  });

  if (existing) {
    await db
      .update(guilds)
      .set({ name, leftAt: null })
      .where(eq(guilds.id, id));
  } else {
    await db.insert(guilds).values({ id, name });
  }

  for (const commandName of DEFAULT_COMMANDS) {
    await db
      .insert(guildCommands)
      .values({ guildId: id, commandName, enabled: true })
      .onConflictDoNothing();
  }
}

export async function recordGuildLeave(db: Db, id: string) {
  await db
    .update(guilds)
    .set({ leftAt: new Date() })
    .where(eq(guilds.id, id));
}

export async function getActiveGuildIds(db: Db): Promise<Set<string>> {
  const rows = await db.query.guilds.findMany({
    where: isNull(guilds.leftAt),
    columns: { id: true },
  });
  return new Set(rows.map((row) => row.id));
}

export async function getGuildWithCommands(db: Db, id: string) {
  return db.query.guilds.findFirst({
    where: eq(guilds.id, id),
    with: {
      guildCommands: true,
    },
  });
}
