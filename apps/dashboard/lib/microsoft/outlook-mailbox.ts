import { encryptWithAuthSecret, getAuthSecretForCrypto } from "@maia/crypto";
import {
  deleteGuildPluginOauthToken,
  upsertGuildPluginOauthRefreshToken,
  type Db,
} from "@maia/db";
import {
  SPACELAB_ROSTER_PLUGIN_ID,
  exchangeMicrosoftAuthorizationCode,
  resolveMicrosoftOAuthConfig,
} from "@maia/microsoft";
import { getDashboardBaseUrl } from "@/lib/dashboard-base-url";

export async function storeOutlookRefreshTokenForGuild(
  db: Db,
  guildId: string,
  refreshToken: string,
): Promise<void> {
  const encrypted = encryptWithAuthSecret(refreshToken, getAuthSecretForCrypto());
  await upsertGuildPluginOauthRefreshToken(db, {
    guildId,
    pluginId: SPACELAB_ROSTER_PLUGIN_ID,
    encryptedRefreshToken: encrypted,
  });
}

export async function completeOutlookOAuthCallback(
  db: Db,
  guildId: string,
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const config = resolveMicrosoftOAuthConfig(getDashboardBaseUrl());
  const tokens = await exchangeMicrosoftAuthorizationCode(
    config,
    code,
    fetchImpl,
  );
  if (!tokens.refresh_token) {
    throw new Error("Microsoft did not return a refresh token");
  }
  await storeOutlookRefreshTokenForGuild(db, guildId, tokens.refresh_token);
}

export async function disconnectOutlookMailbox(
  db: Db,
  guildId: string,
): Promise<boolean> {
  return deleteGuildPluginOauthToken(db, guildId, SPACELAB_ROSTER_PLUGIN_ID);
}
