import { NextResponse } from "next/server";
import { Permission } from "@maia/discord";
import { handleModerationError } from "@/lib/api/http";
import { searchGuildMembers } from "@/lib/discord-bot";
import {
  devHelpersEnabled,
  devMembers,
  DEV_GUILD_ID,
} from "@/lib/dev-fixtures";
import { requireSessionGuildAccess } from "@/lib/session-auth";

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { guildId } = await context.params;
  const access = await requireSessionGuildAccess(
    guildId,
    Permission.ManageRoles,
    "Manage Roles",
  );
  if ("error" in access) {
    return access.error;
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (devHelpersEnabled() && guildId === DEV_GUILD_ID) {
    const filtered = query
      ? devMembers.filter((member) => {
          const name =
            member.nick ??
            member.user.global_name ??
            member.user.username;
          return name.toLowerCase().includes(query.toLowerCase());
        })
      : devMembers;
    return NextResponse.json({ members: filtered });
  }

  if (!query) {
    return NextResponse.json({ members: [] });
  }

  try {
    const members = await searchGuildMembers(guildId, query, 25);
    return NextResponse.json({ members });
  } catch (error) {
    return handleModerationError(error);
  }
}
