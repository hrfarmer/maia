import { NextResponse } from "next/server";
import { Permission } from "@maia/discord";
import { handleModerationError, jsonError } from "@/lib/api/http";
import { devHelpersEnabled, DEV_GUILD_ID } from "@/lib/dev-fixtures";
import {
  moderationBan,
  moderationKick,
  moderationNickname,
  moderationTimeout,
  moderationUntimeout,
} from "@/lib/moderation/service";
import { requireSessionGuildAccess } from "@/lib/session-auth";

interface RouteContext {
  params: Promise<{ guildId: string; userId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { guildId, userId } = await context.params;
  const body = (await request.json()) as {
    action?: string;
    reason?: string;
    minutes?: number;
    nickname?: string | null;
  };

  const permissionForAction = (action: string) => {
    switch (action) {
      case "kick":
        return { perm: Permission.KickMembers, label: "Kick Members" };
      case "ban":
        return { perm: Permission.BanMembers, label: "Ban Members" };
      case "timeout":
      case "untimeout":
        return { perm: Permission.ModerateMembers, label: "Moderate Members" };
      case "nickname":
        return { perm: Permission.ManageNicknames, label: "Manage Nicknames" };
      default:
        return null;
    }
  };

  const perm = permissionForAction(body.action ?? "");
  if (!perm) {
    return jsonError("Invalid action", 400);
  }

  const access = await requireSessionGuildAccess(
    guildId,
    perm.perm,
    perm.label,
  );
  if ("error" in access) {
    return access.error;
  }

  if (devHelpersEnabled() && guildId === DEV_GUILD_ID) {
    return NextResponse.json({ ok: true });
  }

  try {
    switch (body.action) {
      case "kick":
        return NextResponse.json(
          await moderationKick(guildId, userId, body.reason, access.actor),
        );
      case "ban":
        return NextResponse.json(
          await moderationBan(guildId, userId, body.reason, access.actor),
        );
      case "timeout":
        if (!body.minutes || body.minutes < 1) {
          return jsonError("minutes required", 400);
        }
        return NextResponse.json(
          await moderationTimeout(
            guildId,
            userId,
            body.minutes,
            body.reason,
            access.actor,
          ),
        );
      case "untimeout":
        return NextResponse.json(
          await moderationUntimeout(guildId, userId, access.actor),
        );
      case "nickname":
        return NextResponse.json(
          await moderationNickname(
            guildId,
            userId,
            body.nickname === undefined
              ? null
              : body.nickname?.trim()
                ? body.nickname.trim()
                : null,
            access.actor,
          ),
        );
      default:
        return jsonError("Invalid action", 400);
    }
  } catch (error) {
    return handleModerationError(error);
  }
}
