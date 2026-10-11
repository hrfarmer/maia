import { Permission } from "@maia/discord";
import {
  SPACELAB_ROSTER_PLUGIN_ID,
  buildMicrosoftAuthorizeUrl,
  createMicrosoftOAuthState,
  resolveMicrosoftOAuthConfig,
} from "@maia/microsoft";
import { getAuthSecretForCrypto } from "@maia/crypto";
import { getDashboardBaseUrl } from "@/lib/dashboard-base-url";
import { jsonError } from "@/lib/api/http";
import { requireSessionGuildAccess } from "@/lib/session-auth";

export async function GET(
  _request: Request,
  context: { params: Promise<{ guildId: string }> },
) {
  const { guildId } = await context.params;
  const access = await requireSessionGuildAccess(
    guildId,
    Permission.ManageGuild,
    "Manage Server",
  );
  if ("error" in access) {
    return access.error;
  }

  try {
    const config = resolveMicrosoftOAuthConfig(getDashboardBaseUrl());
    const state = createMicrosoftOAuthState(
      { guildId, pluginId: SPACELAB_ROSTER_PLUGIN_ID },
      getAuthSecretForCrypto(),
    );
    const authorizeUrl = buildMicrosoftAuthorizeUrl(config, state);
    return Response.redirect(authorizeUrl, 302);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Microsoft OAuth is not configured";
    return jsonError(message, 500);
  }
}
