import {
  DEFAULT_COMMAND_NAMES,
  normalizeSlashCommandName,
  validateSlashCommandDescription,
  validateSlashCommandName,
  type DiscordApplicationCommandPayload,
  type DiscordApplicationCommandOptionPayload,
} from "@maia/discord";
import { PluginManifestError } from "./manifest.js";

export type PluginSlashVisibility = "public" | "ephemeral";

export type PluginSlashOptionType =
  | "string"
  | "integer"
  | "boolean"
  | "user"
  | "channel"
  | "role";

export interface PluginSlashCommandOption {
  name: string;
  description: string;
  type: PluginSlashOptionType;
  required: boolean;
}

export interface PluginSlashCommand {
  name: string;
  description: string;
  visibility: PluginSlashVisibility;
  defaultPermission: string | null;
  options: PluginSlashCommandOption[];
}

export interface PluginSlashCollision {
  name: string;
  reason: string;
}

export interface PlannedPluginSlashPublish {
  pluginId: string;
  commands: PluginSlashCommand[];
}

export interface GuildSlashCommandPlan {
  discordBody: DiscordApplicationCommandPayload[];
  collisionsByPlugin: Map<string, PluginSlashCollision[]>;
}

const OPTION_TYPE_TO_DISCORD: Record<PluginSlashOptionType, number> = {
  string: 3,
  integer: 4,
  boolean: 5,
  user: 6,
  channel: 7,
  role: 8,
};

const OPTION_TYPES = new Set<string>(Object.keys(OPTION_TYPE_TO_DISCORD));

function parseVisibility(value: unknown): PluginSlashVisibility {
  if (value === undefined || value === null) {
    return "public";
  }
  if (value !== "public" && value !== "ephemeral") {
    throw new PluginManifestError(
      'slash command visibility must be "public" or "ephemeral"',
    );
  }
  return value;
}

function parseDefaultPermission(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "number" && Number.isInteger(value)) {
    return String(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  throw new PluginManifestError(
    "slash command defaultPermission must be an integer permission bitfield",
  );
}

function parseSlashOption(value: unknown, index: number): PluginSlashCommandOption {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new PluginManifestError(
      `slashCommands[].options[${index}] must be an object`,
    );
  }
  const record = value as Record<string, unknown>;
  const nameResult = validateSlashCommandName(String(record.name ?? ""));
  if (!nameResult.ok) {
    throw new PluginManifestError(
      `slashCommands[].options[${index}].name: ${nameResult.error}`,
    );
  }
  const descriptionResult = validateSlashCommandDescription(
    String(record.description ?? ""),
  );
  if (!descriptionResult.ok) {
    throw new PluginManifestError(
      `slashCommands[].options[${index}].description: ${descriptionResult.error}`,
    );
  }
  const type = record.type;
  if (typeof type !== "string" || !OPTION_TYPES.has(type)) {
    throw new PluginManifestError(
      `slashCommands[].options[${index}].type is invalid`,
    );
  }
  return {
    name: nameResult.name,
    description: descriptionResult.description,
    type: type as PluginSlashOptionType,
    required: record.required === true,
  };
}

function parseSlashCommand(value: unknown, index: number): PluginSlashCommand {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new PluginManifestError(`slashCommands[${index}] must be an object`);
  }
  const record = value as Record<string, unknown>;
  const nameResult = validateSlashCommandName(String(record.name ?? ""));
  if (!nameResult.ok) {
    throw new PluginManifestError(
      `slashCommands[${index}].name: ${nameResult.error}`,
    );
  }
  const descriptionResult = validateSlashCommandDescription(
    String(record.description ?? ""),
  );
  if (!descriptionResult.ok) {
    throw new PluginManifestError(
      `slashCommands[${index}].description: ${descriptionResult.error}`,
    );
  }
  const visibility = parseVisibility(record.visibility);
  const defaultPermission = parseDefaultPermission(record.defaultPermission);
  let options: PluginSlashCommandOption[] = [];
  if (record.options !== undefined) {
    if (!Array.isArray(record.options)) {
      throw new PluginManifestError(
        `slashCommands[${index}].options must be an array`,
      );
    }
    options = record.options.map((item, optionIndex) =>
      parseSlashOption(item, optionIndex),
    );
    const optionNames = new Set<string>();
    for (const option of options) {
      if (optionNames.has(option.name)) {
        throw new PluginManifestError(
          `slashCommands[${index}] has duplicate option name ${option.name}`,
        );
      }
      optionNames.add(option.name);
    }
  }
  return {
    name: nameResult.name,
    description: descriptionResult.description,
    visibility,
    defaultPermission,
    options,
  };
}

export function parsePluginSlashCommands(value: unknown): PluginSlashCommand[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new PluginManifestError("slashCommands must be an array");
  }
  const commands: PluginSlashCommand[] = [];
  const names = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const command = parseSlashCommand(value[index], index);
    if (names.has(command.name)) {
      throw new PluginManifestError(
        `slashCommands has duplicate command name ${command.name}`,
      );
    }
    names.add(command.name);
    commands.push(command);
  }
  return commands;
}

export function pluginSlashCommandToDiscordPayload(
  command: PluginSlashCommand,
): DiscordApplicationCommandPayload {
  const payload: DiscordApplicationCommandPayload = {
    type: 1,
    name: command.name,
    description: command.description,
  };
  if (command.options.length > 0) {
    payload.options = command.options.map((option) => ({
      type: OPTION_TYPE_TO_DISCORD[option.type],
      name: option.name,
      description: option.description,
      required: option.required ? true : undefined,
    }));
  }
  if (command.defaultPermission !== null) {
    payload.default_member_permissions = command.defaultPermission;
  }
  return payload;
}

export function planPluginSlashCommandsForGuild(input: {
  customCommandNames: readonly string[];
  plugins: readonly PlannedPluginSlashPublish[];
}): GuildSlashCommandPlan {
  const reserved = new Set<string>(DEFAULT_COMMAND_NAMES);
  const usedNames = new Set<string>([
    ...reserved,
    ...input.customCommandNames.map(normalizeSlashCommandName),
  ]);
  const discordBody: DiscordApplicationCommandPayload[] = [];
  const collisionsByPlugin = new Map<string, PluginSlashCollision[]>();

  for (const entry of input.plugins) {
    const pluginCollisions: PluginSlashCollision[] = [];
    for (const command of entry.commands) {
      const normalized = normalizeSlashCommandName(command.name);
      if (reserved.has(normalized)) {
        pluginCollisions.push({
          name: normalized,
          reason: `Name conflicts with the built-in /${normalized} command.`,
        });
        continue;
      }
      if (usedNames.has(normalized)) {
        pluginCollisions.push({
          name: normalized,
          reason: `Name /${normalized} is already used in this guild.`,
        });
        continue;
      }
      usedNames.add(normalized);
      discordBody.push(pluginSlashCommandToDiscordPayload(command));
    }
    if (pluginCollisions.length > 0) {
      collisionsByPlugin.set(entry.pluginId, pluginCollisions);
    }
  }

  return { discordBody, collisionsByPlugin };
}

export const DISCORD_INTERACTION_TIME_LIMIT_MS = 15 * 60 * 1000;

export function slashRunTimeLimitMs(
  invocationTimeLimitMs: number | null,
): number {
  const manifestLimit =
    invocationTimeLimitMs ?? DISCORD_INTERACTION_TIME_LIMIT_MS;
  return Math.min(manifestLimit, DISCORD_INTERACTION_TIME_LIMIT_MS);
}
