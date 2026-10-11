import { and, asc, eq, isNull } from "drizzle-orm";
import type { Db } from "./client.js";
import { pluginGuildConfigNotifications } from "./schema.js";

export type PluginGuildConfigChangeType =
  | "enabled"
  | "disabled"
  | "values_saved"
  | "adapt_roles_saved";

export async function enqueuePluginGuildConfigNotification(
  db: Db,
  input: {
    pluginId: string;
    guildId: string;
    changeType: PluginGuildConfigChangeType;
  },
) {
  await db.insert(pluginGuildConfigNotifications).values({
    id: crypto.randomUUID(),
    pluginId: input.pluginId,
    guildId: input.guildId,
    changeType: input.changeType,
  });
}

export async function claimNextPluginGuildConfigNotification(db: Db) {
  const row = await db.query.pluginGuildConfigNotifications.findFirst({
    where: isNull(pluginGuildConfigNotifications.deliveredAt),
    orderBy: [asc(pluginGuildConfigNotifications.createdAt)],
  });
  if (!row) {
    return null;
  }

  const [claimed] = await db
    .update(pluginGuildConfigNotifications)
    .set({ deliveredAt: new Date() })
    .where(
      and(
        eq(pluginGuildConfigNotifications.id, row.id),
        isNull(pluginGuildConfigNotifications.deliveredAt),
      ),
    )
    .returning();

  return claimed ?? null;
}
