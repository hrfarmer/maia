import { NextResponse } from "next/server";
import {
  authenticateApiKey,
  handleModerationError,
  jsonError,
} from "@/lib/api/http";
import { listRolesForGuild } from "@/lib/moderation/service";

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { guildId } = await context.params;
  const auth = await authenticateApiKey(request, guildId);
  if ("error" in auth) {
    return auth.error;
  }

  try {
    const roles = await listRolesForGuild(guildId);
    return NextResponse.json({ roles });
  } catch (error) {
    return handleModerationError(error);
  }
}

export async function POST() {
  return jsonError("Method not allowed", 405);
}
