import type { DiscordApplicationCommandPayload } from "./application-command-payload.js";

export interface GuildCustomCommandForSync {
  name: string;
  description: string;
}

export function buildGuildApplicationCommandsBody(input: {
  customCommands: readonly GuildCustomCommandForSync[];
  pluginCommands: readonly DiscordApplicationCommandPayload[];
}): DiscordApplicationCommandPayload[] {
  const customPayloads: DiscordApplicationCommandPayload[] =
    input.customCommands.map((command) => ({
      type: 1,
      name: command.name,
      description: command.description,
    }));
  return [...customPayloads, ...input.pluginCommands];
}
