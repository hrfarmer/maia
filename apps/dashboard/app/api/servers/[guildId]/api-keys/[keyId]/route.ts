import { NextResponse } from "next/server";
import { Permission } from "@maia/discord";
import { getDb, revokeGuildApiKey } from "@maia/db";
import { jsonError } from "@/lib/api/http";
import { requireSessionGuildAccess } from "@/lib/session-auth";

interface RouteContext {
  params: Promise<{ guildId: string; keyId: string }>;
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { guildId, keyId } = await context.params;
  const access = await requireSessionGuildAccess(
    guildId,
    Permission.ManageGuild,
    "Manage Server",
  );
  if ("error" in access) {
    return access.error;
  }

  const db = getDb();
  const revoked = await revokeGuildApiKey(db, guildId, keyId);
  if (!revoked) {
    return jsonError("API key not found", 404);
  }
  return NextResponse.json({ ok: true });
}
