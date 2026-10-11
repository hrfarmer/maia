import { and, eq } from "drizzle-orm";
import type { Db } from "./client.js";
import { guildPluginOauthTokens } from "./schema.js";

export async function getGuildPluginOauthTokenRow(
  db: Db,
  guildId: string,
  pluginId: string,
) {
  const [row] = await db
    .select()
    .from(guildPluginOauthTokens)
    .where(
      and(
        eq(guildPluginOauthTokens.guildId, guildId),
        eq(guildPluginOauthTokens.pluginId, pluginId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function guildPluginOauthTokenConnected(
  db: Db,
  guildId: string,
  pluginId: string,
): Promise<boolean> {
  const row = await getGuildPluginOauthTokenRow(db, guildId, pluginId);
  return row !== null && row.encryptedRefreshToken.length > 0;
}

export async function upsertGuildPluginOauthRefreshToken(
  db: Db,
  input: {
    guildId: string;
    pluginId: string;
    encryptedRefreshToken: string;
  },
): Promise<void> {
  await db
    .insert(guildPluginOauthTokens)
    .values({
      guildId: input.guildId,
      pluginId: input.pluginId,
      encryptedRefreshToken: input.encryptedRefreshToken,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        guildPluginOauthTokens.guildId,
        guildPluginOauthTokens.pluginId,
      ],
      set: {
        encryptedRefreshToken: input.encryptedRefreshToken,
        updatedAt: new Date(),
      },
    });
}

export async function deleteGuildPluginOauthToken(
  db: Db,
  guildId: string,
  pluginId: string,
): Promise<boolean> {
  const result = await db
    .delete(guildPluginOauthTokens)
    .where(
      and(
        eq(guildPluginOauthTokens.guildId, guildId),
        eq(guildPluginOauthTokens.pluginId, pluginId),
      ),
    )
    .returning({ guildId: guildPluginOauthTokens.guildId });
  return result.length > 0;
}
