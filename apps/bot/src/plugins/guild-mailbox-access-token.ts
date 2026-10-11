import { decryptWithAuthSecret, encryptWithAuthSecret } from "@maia/crypto";
import {
  getGuildPluginOauthTokenRow,
  upsertGuildPluginOauthRefreshToken,
  type Db,
} from "@maia/db";
import {
  refreshMicrosoftAccessToken,
  resolveMicrosoftOAuthConfig,
} from "@maia/microsoft";

export class MailboxNotConnectedError extends Error {
  constructor() {
    super("mailbox_not_connected");
    this.name = "MailboxNotConnectedError";
  }
}

export class MailboxTokenRefreshError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailboxTokenRefreshError";
  }
}

export interface GuildMailboxAccessToken {
  accessToken: string;
  expiresIn: number;
}

function resolveMicrosoftOAuthBaseUrl(): string {
  return (
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    "http://localhost:3000"
  );
}

export interface RefreshGuildMailboxAccessTokenDeps {
  getGuildPluginOauthTokenRow: (
    db: Db,
    guildId: string,
    pluginId: string,
  ) => Promise<{
    guildId: string;
    pluginId: string;
    encryptedRefreshToken: string;
    updatedAt: Date;
  } | null>;
  upsertGuildPluginOauthRefreshToken: typeof upsertGuildPluginOauthRefreshToken;
}

function defaultRefreshDeps(): RefreshGuildMailboxAccessTokenDeps {
  return {
    getGuildPluginOauthTokenRow,
    upsertGuildPluginOauthRefreshToken,
  };
}

export async function refreshGuildMailboxAccessToken(
  db: Db,
  guildId: string,
  pluginId: string,
  fetchImpl: typeof fetch = fetch,
  deps: RefreshGuildMailboxAccessTokenDeps = defaultRefreshDeps(),
): Promise<GuildMailboxAccessToken> {
  const row = await deps.getGuildPluginOauthTokenRow(db, guildId, pluginId);
  if (!row?.encryptedRefreshToken) {
    throw new MailboxNotConnectedError();
  }

  let refreshToken: string;
  try {
    refreshToken = decryptWithAuthSecret(row.encryptedRefreshToken);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to decrypt refresh token";
    throw new MailboxTokenRefreshError(message);
  }

  const config = resolveMicrosoftOAuthConfig(resolveMicrosoftOAuthBaseUrl());
  let tokens;
  try {
    tokens = await refreshMicrosoftAccessToken(config, refreshToken, fetchImpl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Microsoft token refresh failed";
    throw new MailboxTokenRefreshError(message);
  }

  if (tokens.refresh_token && tokens.refresh_token !== refreshToken) {
    const encrypted = encryptWithAuthSecret(tokens.refresh_token);
    await deps.upsertGuildPluginOauthRefreshToken(db, {
      guildId,
      pluginId,
      encryptedRefreshToken: encrypted,
    });
  }

  return {
    accessToken: tokens.access_token,
    expiresIn: tokens.expires_in,
  };
}
