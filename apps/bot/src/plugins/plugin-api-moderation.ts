import type { IncomingMessage, ServerResponse } from "node:http";
import {
  ModerationError,
  getMemberRoleIds,
  listRolesForGuild,
  moderationAddRole,
  moderationBan,
  moderationCreateRole,
  moderationDeleteRole,
  moderationKick,
  moderationNickname,
  moderationRemoveRole,
  moderationSetRoles,
  moderationTimeout,
  moderationUnban,
  moderationUntimeout,
  moderationUpdateRole,
  parseRoleCreateInput,
  parseRoleUpdateInput,
  searchGuildMembersForModeration,
  type ModerationActor,
} from "@maia/moderation";
import { isDiscordSnowflake, readJsonBody } from "./plugin-api-auth.js";

export interface PluginModerationHandlers {
  listRolesForGuild: typeof listRolesForGuild;
  moderationCreateRole: typeof moderationCreateRole;
  moderationUpdateRole: typeof moderationUpdateRole;
  moderationDeleteRole: typeof moderationDeleteRole;
  searchGuildMembersForModeration: typeof searchGuildMembersForModeration;
  getMemberRoleIds: typeof getMemberRoleIds;
  moderationSetRoles: typeof moderationSetRoles;
  moderationAddRole: typeof moderationAddRole;
  moderationRemoveRole: typeof moderationRemoveRole;
  moderationKick: typeof moderationKick;
  moderationBan: typeof moderationBan;
  moderationUnban: typeof moderationUnban;
  moderationTimeout: typeof moderationTimeout;
  moderationUntimeout: typeof moderationUntimeout;
  moderationNickname: typeof moderationNickname;
}

export function defaultPluginModerationHandlers(): PluginModerationHandlers {
  return {
    listRolesForGuild,
    moderationCreateRole,
    moderationUpdateRole,
    moderationDeleteRole,
    searchGuildMembersForModeration,
    getMemberRoleIds,
    moderationSetRoles,
    moderationAddRole,
    moderationRemoveRole,
    moderationKick,
    moderationBan,
    moderationUnban,
    moderationTimeout,
    moderationUntimeout,
    moderationNickname,
  };
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: Record<string, unknown>,
) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function handleModerationError(res: ServerResponse, error: unknown) {
  if (error instanceof ModerationError) {
    sendJson(res, 400, { error: error.message });
    return;
  }
  if (error instanceof Error) {
    sendJson(res, 500, { error: error.message });
    return;
  }
  sendJson(res, 500, { error: "Unexpected error" });
}

export async function tryHandlePluginModerationRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  guildId: string,
  actor: ModerationActor,
  handlers: PluginModerationHandlers,
): Promise<boolean> {
  const pathname = url.pathname;

  const rolesMatch = pathname.match(/^\/v1\/guilds\/([^/]+)\/roles$/);
  if (rolesMatch && rolesMatch[1] === guildId) {
    if (req.method === "GET") {
      try {
        const roles = await handlers.listRolesForGuild(guildId);
        sendJson(res, 200, { roles });
      } catch (error) {
        handleModerationError(res, error);
      }
      return true;
    }
    if (req.method === "POST") {
      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch {
        sendJson(res, 400, { error: "Invalid JSON body" });
        return true;
      }
      const parsed = parseRoleCreateInput(body);
      if (!parsed.ok) {
        sendJson(res, 400, { error: parsed.error });
        return true;
      }
      try {
        const result = await handlers.moderationCreateRole(
          guildId,
          parsed.value,
          actor,
        );
        sendJson(res, 201, result as Record<string, unknown>);
      } catch (error) {
        handleModerationError(res, error);
      }
      return true;
    }
  }

  const roleMatch = pathname.match(/^\/v1\/guilds\/([^/]+)\/roles\/([^/]+)$/);
  if (roleMatch && roleMatch[1] === guildId) {
    const roleId = roleMatch[2];
    if (req.method === "PATCH") {
      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch {
        sendJson(res, 400, { error: "Invalid JSON body" });
        return true;
      }
      const parsed = parseRoleUpdateInput(body);
      if (!parsed.ok) {
        sendJson(res, 400, { error: parsed.error });
        return true;
      }
      try {
        const result = await handlers.moderationUpdateRole(
          guildId,
          roleId,
          parsed.value,
          actor,
        );
        sendJson(res, 200, result as Record<string, unknown>);
      } catch (error) {
        handleModerationError(res, error);
      }
      return true;
    }
    if (req.method === "DELETE") {
      try {
        const result = await handlers.moderationDeleteRole(
          guildId,
          roleId,
          actor,
        );
        sendJson(res, 200, result as Record<string, unknown>);
      } catch (error) {
        handleModerationError(res, error);
      }
      return true;
    }
  }

  const membersMatch = pathname.match(/^\/v1\/guilds\/([^/]+)\/members$/);
  if (membersMatch && membersMatch[1] === guildId && req.method === "GET") {
    const query =
      url.searchParams.get("query") ?? url.searchParams.get("q") ?? "";
    try {
      const members = await handlers.searchGuildMembersForModeration(
        guildId,
        query,
      );
      sendJson(res, 200, { members });
    } catch (error) {
      handleModerationError(res, error);
    }
    return true;
  }

  const memberRolesMatch = pathname.match(
    /^\/v1\/guilds\/([^/]+)\/members\/([^/]+)\/roles$/,
  );
  if (memberRolesMatch && memberRolesMatch[1] === guildId) {
    const userId = memberRolesMatch[2];
    if (!isDiscordSnowflake(userId)) {
      sendJson(res, 400, { error: "Invalid user ID" });
      return true;
    }
    if (req.method === "GET") {
      try {
        const roleIds = await handlers.getMemberRoleIds(guildId, userId);
        sendJson(res, 200, { userId, roleIds });
      } catch (error) {
        handleModerationError(res, error);
      }
      return true;
    }
    if (req.method === "PUT") {
      let body: { roleIds?: unknown };
      try {
        body = (await readJsonBody(req)) as { roleIds?: unknown };
      } catch {
        sendJson(res, 400, { error: "Invalid JSON body" });
        return true;
      }
      if (
        !Array.isArray(body?.roleIds) ||
        !body.roleIds.every((id) => typeof id === "string")
      ) {
        sendJson(res, 400, { error: "roleIds must be an array of strings" });
        return true;
      }
      try {
        const result = await handlers.moderationSetRoles(
          guildId,
          userId,
          body.roleIds,
          actor,
        );
        sendJson(res, 200, result as Record<string, unknown>);
      } catch (error) {
        handleModerationError(res, error);
      }
      return true;
    }
  }

  const memberRoleMatch = pathname.match(
    /^\/v1\/guilds\/([^/]+)\/members\/([^/]+)\/roles\/([^/]+)$/,
  );
  if (memberRoleMatch && memberRoleMatch[1] === guildId) {
    const userId = memberRoleMatch[2];
    const roleId = memberRoleMatch[3];
    if (!isDiscordSnowflake(userId)) {
      sendJson(res, 400, { error: "Invalid user ID" });
      return true;
    }
    if (req.method === "PUT") {
      try {
        const result = await handlers.moderationAddRole(
          guildId,
          userId,
          roleId,
          actor,
        );
        sendJson(res, 200, result as Record<string, unknown>);
      } catch (error) {
        handleModerationError(res, error);
      }
      return true;
    }
    if (req.method === "DELETE") {
      try {
        const result = await handlers.moderationRemoveRole(
          guildId,
          userId,
          roleId,
          actor,
        );
        sendJson(res, 200, result as Record<string, unknown>);
      } catch (error) {
        handleModerationError(res, error);
      }
      return true;
    }
  }

  const kickMatch = pathname.match(
    /^\/v1\/guilds\/([^/]+)\/members\/([^/]+)\/kick$/,
  );
  if (kickMatch && kickMatch[1] === guildId && req.method === "POST") {
    const userId = kickMatch[2];
    if (!isDiscordSnowflake(userId)) {
      sendJson(res, 400, { error: "Invalid user ID" });
      return true;
    }
    let reason: string | undefined;
    try {
      const body = (await readJsonBody(req)) as { reason?: string } | undefined;
      reason = body?.reason;
    } catch {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return true;
    }
    try {
      const result = await handlers.moderationKick(
        guildId,
        userId,
        reason,
        actor,
      );
      sendJson(res, 200, result as Record<string, unknown>);
    } catch (error) {
      handleModerationError(res, error);
    }
    return true;
  }

  const banMatch = pathname.match(
    /^\/v1\/guilds\/([^/]+)\/members\/([^/]+)\/ban$/,
  );
  if (banMatch && banMatch[1] === guildId && req.method === "POST") {
    const userId = banMatch[2];
    if (!isDiscordSnowflake(userId)) {
      sendJson(res, 400, { error: "Invalid user ID" });
      return true;
    }
    let reason: string | undefined;
    try {
      const body = (await readJsonBody(req)) as { reason?: string } | undefined;
      reason = body?.reason;
    } catch {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return true;
    }
    try {
      const result = await handlers.moderationBan(
        guildId,
        userId,
        reason,
        actor,
      );
      sendJson(res, 200, result as Record<string, unknown>);
    } catch (error) {
      handleModerationError(res, error);
    }
    return true;
  }

  const unbanMatch = pathname.match(/^\/v1\/guilds\/([^/]+)\/bans\/([^/]+)$/);
  if (unbanMatch && unbanMatch[1] === guildId && req.method === "DELETE") {
    const userId = unbanMatch[2];
    if (!isDiscordSnowflake(userId)) {
      sendJson(res, 400, { error: "Invalid user ID" });
      return true;
    }
    try {
      const result = await handlers.moderationUnban(guildId, userId, actor);
      sendJson(res, 200, result as Record<string, unknown>);
    } catch (error) {
      handleModerationError(res, error);
    }
    return true;
  }

  const timeoutMatch = pathname.match(
    /^\/v1\/guilds\/([^/]+)\/members\/([^/]+)\/timeout$/,
  );
  if (timeoutMatch && timeoutMatch[1] === guildId) {
    const userId = timeoutMatch[2];
    if (!isDiscordSnowflake(userId)) {
      sendJson(res, 400, { error: "Invalid user ID" });
      return true;
    }
    if (req.method === "POST") {
      let body: { minutes?: unknown; reason?: string };
      try {
        body = (await readJsonBody(req)) as {
          minutes?: unknown;
          reason?: string;
        };
      } catch {
        sendJson(res, 400, { error: "Invalid JSON body" });
        return true;
      }
      if (
        typeof body?.minutes !== "number" ||
        body.minutes < 1 ||
        body.minutes > 40320
      ) {
        sendJson(res, 400, {
          error: "minutes must be between 1 and 40320",
        });
        return true;
      }
      try {
        const result = await handlers.moderationTimeout(
          guildId,
          userId,
          body.minutes,
          body.reason,
          actor,
        );
        sendJson(res, 200, result as Record<string, unknown>);
      } catch (error) {
        handleModerationError(res, error);
      }
      return true;
    }
    if (req.method === "DELETE") {
      try {
        const result = await handlers.moderationUntimeout(
          guildId,
          userId,
          actor,
        );
        sendJson(res, 200, result as Record<string, unknown>);
      } catch (error) {
        handleModerationError(res, error);
      }
      return true;
    }
  }

  const nicknameMatch = pathname.match(
    /^\/v1\/guilds\/([^/]+)\/members\/([^/]+)\/nickname$/,
  );
  if (
    nicknameMatch &&
    nicknameMatch[1] === guildId &&
    req.method === "PATCH"
  ) {
    const userId = nicknameMatch[2];
    if (!isDiscordSnowflake(userId)) {
      sendJson(res, 400, { error: "Invalid user ID" });
      return true;
    }
    let body: { nickname?: unknown };
    try {
      body = (await readJsonBody(req)) as { nickname?: unknown };
    } catch {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return true;
    }
    const nickname =
      body?.nickname === null
        ? null
        : typeof body?.nickname === "string"
          ? body.nickname.trim() || null
          : undefined;
    if (nickname === undefined) {
      sendJson(res, 400, { error: "nickname must be a string or null" });
      return true;
    }
    try {
      const result = await handlers.moderationNickname(
        guildId,
        userId,
        nickname,
        actor,
      );
      sendJson(res, 200, result as Record<string, unknown>);
    } catch (error) {
      handleModerationError(res, error);
    }
    return true;
  }

  return false;
}
