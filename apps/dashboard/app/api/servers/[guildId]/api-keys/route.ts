import { NextResponse } from "next/server";
import { Permission } from "@maia/discord";
import {
  createGuildApiKey,
  getDb,
  listGuildApiKeys,
} from "@maia/db";
import { jsonError } from "@/lib/api/http";
import { requireSessionGuildAccess } from "@/lib/session-auth";

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { guildId } = await context.params;
  const access = await requireSessionGuildAccess(
    guildId,
    Permission.ManageGuild,
    "Manage Server",
  );
  if ("error" in access) {
    return access.error;
  }

  if (process.env.MAIA_ENABLE_DEV_HELPERS === "1") {
    try {
      const db = getDb();
      const keys = await listGuildApiKeys(db, guildId);
      return NextResponse.json({ keys });
    } catch {
      return NextResponse.json({ keys: [] });
    }
  }

  const db = getDb();
  const keys = await listGuildApiKeys(db, guildId);
  return NextResponse.json({ keys });
}

export async function POST(request: Request, context: RouteContext) {
  const { guildId } = await context.params;
  const access = await requireSessionGuildAccess(
    guildId,
    Permission.ManageGuild,
    "Manage Server",
  );
  if ("error" in access) {
    return access.error;
  }

  const body = (await request.json()) as { name?: string };
  const name = body.name?.trim();
  if (!name) {
    return jsonError("name is required", 400);
  }

  const db = getDb();
  const created = await createGuildApiKey(db, guildId, name);
  return NextResponse.json({
    key: {
      id: created.id,
      name: created.name,
      createdAt: created.createdAt,
      token: created.rawKey,
    },
  });
}
