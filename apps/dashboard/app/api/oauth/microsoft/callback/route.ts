import { Permission } from "@maia/discord";
import { getDb } from "@maia/db";
import { getAuthSecretForCrypto } from "@maia/crypto";
import { parseMicrosoftOAuthState } from "@maia/microsoft";
import { auth } from "@/auth";
import { completeOutlookOAuthCallback } from "@/lib/microsoft/outlook-mailbox";
import { getDashboardBaseUrl } from "@/lib/dashboard-base-url";
import {
  AccessDeniedError,
  getUserPermissionsInGuild,
  requireUserPermission,
} from "@/lib/guild-access";

function redirectToPluginSettings(guildId: string, query?: string) {
  const base = `/servers/${guildId}`;
  const url = query ? `${base}?${query}` : base;
  return Response.redirect(new URL(url, getDashboardBaseUrl()), 302);
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return Response.redirect(
      new URL("/api/auth/signin", getDashboardBaseUrl()),
      302,
    );
  }

  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (error) {
    return new Response(`Microsoft sign-in failed: ${error}`, { status: 400 });
  }
  if (!code || !state) {
    return new Response("Missing OAuth code or state", { status: 400 });
  }

  let guildId: string;
  try {
    const payload = parseMicrosoftOAuthState(state, getAuthSecretForCrypto());
    guildId = payload.guildId;
  } catch {
    return new Response("Invalid OAuth state", { status: 400 });
  }

  const permissions = await getUserPermissionsInGuild(
    session.accessToken,
    guildId,
  );
  if (permissions === null) {
    return new Response("Forbidden", { status: 403 });
  }
  try {
    requireUserPermission(permissions, Permission.ManageGuild, "Manage Server");
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      return new Response(err.message, { status: 403 });
    }
    throw err;
  }

  try {
    const db = getDb();
    await completeOutlookOAuthCallback(db, guildId, code);
    return redirectToPluginSettings(guildId, "outlook=connected");
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth callback failed";
    return redirectToPluginSettings(guildId, `outlook=error&message=${encodeURIComponent(message)}`);
  }
}
