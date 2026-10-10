import { auth } from "@/auth";
import {
  AccessDeniedError,
  getUserPermissionsInGuild,
  requireUserPermission,
} from "./guild-access";
import { jsonError } from "./api/http";

export async function requireSessionGuildAccess(
  guildId: string,
  requiredPermission: bigint,
  permissionLabel: string,
) {
  const session = await auth();
  if (!session?.accessToken) {
    return { error: jsonError("Unauthorized", 401) };
  }

  const permissions = await getUserPermissionsInGuild(
    session.accessToken,
    guildId,
  );
  if (permissions === null) {
    return { error: jsonError("Forbidden", 403) };
  }

  try {
    requireUserPermission(permissions, requiredPermission, permissionLabel);
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { error: jsonError(error.message, 403) };
    }
    throw error;
  }

  return {
    session,
    actor: {
      source: "dashboard" as const,
      id: session.user?.id ?? "unknown",
      label: session.user?.name ?? undefined,
    },
  };
}
