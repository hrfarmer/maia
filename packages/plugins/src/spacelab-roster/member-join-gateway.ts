export interface MemberJoinGatewayMember {
  discordUserId: string;
  username: string;
}

export function parseMemberJoinGatewayPayload(
  payload: unknown,
): MemberJoinGatewayMember | null {
  if (payload === null || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const user =
    record.user && typeof record.user === "object"
      ? (record.user as Record<string, unknown>)
      : record;
  const discordUserId =
    typeof user.id === "string"
      ? user.id
      : typeof record.id === "string"
        ? record.id
        : null;
  const username =
    typeof user.username === "string"
      ? user.username
      : typeof record.username === "string"
        ? record.username
        : null;
  if (!discordUserId || !username) {
    return null;
  }
  return { discordUserId, username };
}
