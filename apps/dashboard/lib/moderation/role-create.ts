import { Permission, hasPermission } from "@maia/discord";
import type { DiscordGuildMember, DiscordRole } from "../discord-bot";
import { ModerationError } from "./hierarchy";

export interface RoleCreateInput {
  name: string;
  color?: number;
  hoist?: boolean;
  mentionable?: boolean;
  permissions?: string;
}

export interface ParsedRoleCreate {
  name: string;
  color?: number;
  hoist: boolean;
  mentionable: boolean;
  permissions?: string;
}

export function computeGuildPermissions(
  member: DiscordGuildMember,
  roles: DiscordRole[],
  guildId: string,
): bigint {
  const everyone = roles.find((role) => role.id === guildId);
  let perms = everyone ? BigInt(everyone.permissions) : 0n;
  for (const roleId of member.roles) {
    const role = roles.find((item) => item.id === roleId);
    if (!role) {
      continue;
    }
    perms |= BigInt(role.permissions);
    if ((perms & Permission.Administrator) === Permission.Administrator) {
      return perms;
    }
  }
  return perms;
}

export function assertBotCanManageRoles(
  botMember: DiscordGuildMember,
  roles: DiscordRole[],
  guildId: string,
) {
  const botPerms = computeGuildPermissions(botMember, roles, guildId);
  if (!hasPermission(botPerms, Permission.ManageRoles)) {
    throw new ModerationError(
      "Maia needs the Manage Roles permission to do that.",
    );
  }
  return botPerms;
}

export function sanitizeRolePermissions(
  requested: string | undefined,
  botPerms: bigint,
): string {
  if (requested === undefined) {
    return "0";
  }
  if (!/^\d+$/.test(requested)) {
    throw new ModerationError("permissions must be a numeric bitfield string.");
  }
  return (BigInt(requested) & botPerms).toString();
}

function parseColor(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      return undefined;
    }
    const normalized = trimmed.replace(/^#/, "");
    if (/^[0-9a-fA-F]{6}$/.test(normalized)) {
      return Number.parseInt(normalized, 16);
    }
    throw new ModerationError("color must be a hex value like #5865F2.");
  }
  throw new ModerationError("color must be a hex string or integer.");
}

function parseBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new ModerationError(`${field} must be a boolean.`);
  }
  return value;
}

export function parseRoleCreateInput(
  body: unknown,
): { ok: true; value: ParsedRoleCreate } | { ok: false; error: string } {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const record = body as Record<string, unknown>;

  if (typeof record.name !== "string") {
    return { ok: false, error: "name is required and must be a string." };
  }

  const name = record.name.trim();
  if (name.length === 0) {
    return { ok: false, error: "name cannot be empty." };
  }
  if (name.length > 100) {
    return { ok: false, error: "name must be at most 100 characters." };
  }

  try {
    const color = parseColor(record.color);
    const hoist = parseBoolean(record.hoist, "hoist");
    const mentionable = parseBoolean(record.mentionable, "mentionable");

    let permissions: string | undefined;
    if (record.permissions !== undefined) {
      if (typeof record.permissions !== "string") {
        return {
          ok: false,
          error: "permissions must be a numeric bitfield string.",
        };
      }
      if (!/^\d+$/.test(record.permissions)) {
        return {
          ok: false,
          error: "permissions must be a numeric bitfield string.",
        };
      }
      permissions = record.permissions;
    }

    return {
      ok: true,
      value: {
        name,
        color,
        hoist: hoist ?? false,
        mentionable: mentionable ?? false,
        permissions,
      },
    };
  } catch (error) {
    if (error instanceof ModerationError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
