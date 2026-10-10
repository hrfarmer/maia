import { NextResponse } from "next/server";
import {
  authenticateApiKey,
  handleModerationError,
  jsonError,
} from "@/lib/api/http";
import { parseRoleCreateInput } from "@/lib/moderation/role-create";
import {
  listRolesForGuild,
  moderationCreateRole,
} from "@/lib/moderation/service";

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

export async function POST(request: Request, context: RouteContext) {
  const { guildId } = await context.params;
  const auth = await authenticateApiKey(request, guildId);
  if ("error" in auth) {
    return auth.error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = parseRoleCreateInput(body);
  if (!parsed.ok) {
    return jsonError(parsed.error, 400);
  }

  try {
    const result = await moderationCreateRole(
      guildId,
      parsed.value,
      auth.actor,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleModerationError(error);
  }
}
