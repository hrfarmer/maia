const DISCORD_API = "https://discord.com/api/v10";

export class DiscordApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
  ) {
    super(message);
    this.name = "DiscordApiError";
  }
}

function getBotToken(): string {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    throw new Error("DISCORD_TOKEN is not set");
  }
  return token;
}

let cachedBotUserId: string | null = null;

export async function getBotUserId(): Promise<string> {
  if (cachedBotUserId) {
    return cachedBotUserId;
  }
  const data = await discordFetch<{ id: string }>("/users/@me");
  cachedBotUserId = data.id;
  return data.id;
}

export async function discordFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${DISCORD_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${getBotToken()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
    code?: number;
  };

  if (!response.ok) {
    throw new DiscordApiError(
      body.message ?? `Discord API ${response.status}`,
      response.status,
      body.code,
    );
  }

  return body as T;
}

export interface DiscordGuild {
  id: string;
  name: string;
  owner_id: string;
}

export async function fetchGuild(guildId: string): Promise<DiscordGuild> {
  return discordFetch<DiscordGuild>(`/guilds/${guildId}`);
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
  permissions: string;
  hoist?: boolean;
  mentionable?: boolean;
}

export interface CreateGuildRoleInput {
  name: string;
  color?: number;
  hoist?: boolean;
  mentionable?: boolean;
  permissions?: string;
  reason?: string;
}

export interface DiscordGuildMember {
  user?: { id: string; username: string; global_name?: string | null };
  nick?: string | null;
  roles: string[];
  communication_disabled_until?: string | null;
}

export async function fetchGuildRoles(guildId: string): Promise<DiscordRole[]> {
  return discordFetch<DiscordRole[]>(`/guilds/${guildId}/roles`);
}

export interface UpdateGuildRoleInput {
  name?: string;
  color?: number;
  hoist?: boolean;
  mentionable?: boolean;
  reason?: string;
}

export async function updateGuildRole(
  guildId: string,
  roleId: string,
  input: UpdateGuildRoleInput,
): Promise<DiscordRole> {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) {
    payload.name = input.name;
  }
  if (input.color !== undefined) {
    payload.color = input.color;
  }
  if (input.hoist !== undefined) {
    payload.hoist = input.hoist;
  }
  if (input.mentionable !== undefined) {
    payload.mentionable = input.mentionable;
  }
  const headers: Record<string, string> = {};
  if (input.reason) {
    headers["X-Audit-Log-Reason"] = input.reason.slice(0, 512);
  }
  return discordFetch<DiscordRole>(`/guilds/${guildId}/roles/${roleId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });
}

export async function deleteGuildRole(
  guildId: string,
  roleId: string,
  reason?: string,
) {
  const headers: Record<string, string> = {};
  if (reason) {
    headers["X-Audit-Log-Reason"] = reason.slice(0, 512);
  }
  await discordFetch(`/guilds/${guildId}/roles/${roleId}`, {
    method: "DELETE",
    headers,
  });
}

export async function createGuildRole(
  guildId: string,
  input: CreateGuildRoleInput,
): Promise<DiscordRole> {
  const payload: Record<string, unknown> = {
    name: input.name,
    permissions: input.permissions ?? "0",
    hoist: input.hoist ?? false,
    mentionable: input.mentionable ?? false,
  };
  if (input.color !== undefined) {
    payload.color = input.color;
  }
  const headers: Record<string, string> = {};
  if (input.reason) {
    headers["X-Audit-Log-Reason"] = input.reason.slice(0, 512);
  }
  return discordFetch<DiscordRole>(`/guilds/${guildId}/roles`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

export async function fetchGuildMember(
  guildId: string,
  userId: string,
): Promise<DiscordGuildMember> {
  return discordFetch<DiscordGuildMember>(
    `/guilds/${guildId}/members/${userId}`,
  );
}

export async function searchGuildMembers(
  guildId: string,
  query: string,
  limit = 25,
): Promise<DiscordGuildMember[]> {
  const params = new URLSearchParams({ query, limit: String(limit) });
  return discordFetch<DiscordGuildMember[]>(
    `/guilds/${guildId}/members/search?${params.toString()}`,
  );
}

export async function addMemberRole(
  guildId: string,
  userId: string,
  roleId: string,
  reason?: string,
) {
  await discordFetch(
    `/guilds/${guildId}/members/${userId}/roles/${roleId}`,
    {
      method: "PUT",
      body: reason ? JSON.stringify({ reason }) : undefined,
    },
  );
}

export async function removeMemberRole(
  guildId: string,
  userId: string,
  roleId: string,
) {
  await discordFetch(
    `/guilds/${guildId}/members/${userId}/roles/${roleId}`,
    { method: "DELETE" },
  );
}

export async function setMemberRoles(
  guildId: string,
  userId: string,
  roleIds: string[],
) {
  await discordFetch(`/guilds/${guildId}/members/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ roles: roleIds }),
  });
}

export async function kickMember(
  guildId: string,
  userId: string,
  reason?: string,
) {
  const params = reason
    ? `?${new URLSearchParams({ reason }).toString()}`
    : "";
  await discordFetch(`/guilds/${guildId}/members/${userId}${params}`, {
    method: "DELETE",
  });
}

export async function banMember(
  guildId: string,
  userId: string,
  reason?: string,
) {
  await discordFetch(`/guilds/${guildId}/bans/${userId}`, {
    method: "PUT",
    body: JSON.stringify({ delete_message_days: 0, reason }),
  });
}

export async function unbanMember(guildId: string, userId: string) {
  await discordFetch(`/guilds/${guildId}/bans/${userId}`, {
    method: "DELETE",
  });
}

export async function setMemberTimeout(
  guildId: string,
  userId: string,
  untilIso: string | null,
  reason?: string,
) {
  await discordFetch(`/guilds/${guildId}/members/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({
      communication_disabled_until: untilIso,
      reason,
    }),
  });
}

export async function setMemberNickname(
  guildId: string,
  userId: string,
  nick: string | null,
  reason?: string,
) {
  await discordFetch(`/guilds/${guildId}/members/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ nick, reason }),
  });
}

export interface DiscordGuildChannel {
  id: string;
  type: number;
  name: string;
  parent_id?: string | null;
  permission_overwrites?: Array<{
    id: string;
    type: number;
    allow: string;
    deny: string;
  }>;
}

export async function fetchGuildChannels(
  guildId: string,
): Promise<DiscordGuildChannel[]> {
  return discordFetch<DiscordGuildChannel[]>(`/guilds/${guildId}/channels`);
}

export interface CreateChannelMessageInput {
  content: string;
  replyToMessageId?: string;
  reason?: string;
}

export interface DiscordMessage {
  id: string;
  content?: string;
}

export async function createChannelMessage(
  channelId: string,
  input: CreateChannelMessageInput,
): Promise<DiscordMessage> {
  const payload: Record<string, unknown> = { content: input.content };
  if (input.replyToMessageId) {
    payload.message_reference = {
      message_id: input.replyToMessageId,
      fail_if_not_exists: false,
    };
  }
  const headers: Record<string, string> = {};
  if (input.reason) {
    headers["X-Audit-Log-Reason"] = input.reason.slice(0, 512);
  }
  return discordFetch<DiscordMessage>(`/channels/${channelId}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

export interface DiscordMessageAuthor {
  id: string;
}

export interface DiscordChannelMessage extends DiscordMessage {
  channel_id?: string;
  author?: DiscordMessageAuthor;
}

export async function fetchChannelMessages(
  channelId: string,
  limit: number,
): Promise<DiscordChannelMessage[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  return discordFetch<DiscordChannelMessage[]>(
    `/channels/${channelId}/messages?${params.toString()}`,
  );
}

export async function fetchChannelMessage(
  channelId: string,
  messageId: string,
): Promise<DiscordChannelMessage> {
  return discordFetch<DiscordChannelMessage>(
    `/channels/${channelId}/messages/${messageId}`,
  );
}

export async function deleteChannelMessage(
  channelId: string,
  messageId: string,
  reason?: string,
) {
  const headers: Record<string, string> = {};
  if (reason) {
    headers["X-Audit-Log-Reason"] = reason.slice(0, 512);
  }
  await discordFetch(`/channels/${channelId}/messages/${messageId}`, {
    method: "DELETE",
    headers,
  });
}

function encodeReactionEmoji(emoji: string): string {
  return encodeURIComponent(emoji);
}

export async function addOwnMessageReaction(
  channelId: string,
  messageId: string,
  emoji: string,
  reason?: string,
) {
  const headers: Record<string, string> = {};
  if (reason) {
    headers["X-Audit-Log-Reason"] = reason.slice(0, 512);
  }
  await discordFetch(
    `/channels/${channelId}/messages/${messageId}/reactions/${encodeReactionEmoji(emoji)}/@me`,
    {
      method: "PUT",
      headers,
    },
  );
}

export async function removeOwnMessageReaction(
  channelId: string,
  messageId: string,
  emoji: string,
  reason?: string,
) {
  const headers: Record<string, string> = {};
  if (reason) {
    headers["X-Audit-Log-Reason"] = reason.slice(0, 512);
  }
  await discordFetch(
    `/channels/${channelId}/messages/${messageId}/reactions/${encodeReactionEmoji(emoji)}/@me`,
    {
      method: "DELETE",
      headers,
    },
  );
}
