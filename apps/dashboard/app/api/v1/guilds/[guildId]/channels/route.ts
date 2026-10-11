import { NextResponse } from "next/server";
import { listViewableGuildChannels } from "@/lib/moderation/service";
import {
  authenticateApiKey,
  handleModerationError,
} from "@/lib/api/http";

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
    const channels = await listViewableGuildChannels(guildId);
    return NextResponse.json({ channels });
  } catch (error) {
    return handleModerationError(error);
  }
}
