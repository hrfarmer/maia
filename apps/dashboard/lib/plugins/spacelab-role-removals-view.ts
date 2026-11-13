export interface SpacelabRoleRemovalFlagInput {
  discordUserId: string;
  discordHandle: string;
  roleIds: string[];
  flaggedAt: Date;
}

export interface SpacelabRoleRemovalRow {
  discordUserId: string;
  discordHandle: string;
  roles: Array<{ id: string; name: string }>;
  flaggedAt: string;
}

export interface SpacelabRoleRemovalsView {
  flags: SpacelabRoleRemovalRow[];
}

export type SpacelabRoleRemovalDecision =
  | { action: "confirm" }
  | { action: "ignore"; duration: "week" | "forever" };

export function buildSpacelabRoleRemovalsView(
  flags: SpacelabRoleRemovalFlagInput[],
  guildRoles: Array<{ id: string; name: string }>,
): SpacelabRoleRemovalsView {
  const roleNames = new Map(guildRoles.map((role) => [role.id, role.name]));
  return {
    flags: flags.map((flag) => ({
      discordUserId: flag.discordUserId,
      discordHandle: flag.discordHandle,
      roles: flag.roleIds.map((id) => ({ id, name: roleNames.get(id) ?? id })),
      flaggedAt: flag.flaggedAt.toISOString(),
    })),
  };
}

export function parseSpacelabRoleRemovalDecision(
  raw: unknown,
): SpacelabRoleRemovalDecision | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const body = raw as { action?: unknown; duration?: unknown };
  if (body.action === "confirm") {
    return { action: "confirm" };
  }
  if (
    body.action === "ignore" &&
    (body.duration === "week" || body.duration === "forever")
  ) {
    return { action: "ignore", duration: body.duration };
  }
  return null;
}
