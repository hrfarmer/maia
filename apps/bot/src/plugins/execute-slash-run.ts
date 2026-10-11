import path from "node:path";
import type { ChatInputCommandInteraction } from "discord.js";
import {
  buildAlwaysOnSlashStdin,
  buildPluginProcessEnvironment,
  buildSlashInvocationStdin,
  resolvePluginsDirectory,
  runPluginProcess,
  slashRunTimeLimitMs,
  type SlashOptionValue,
} from "@maia/plugins";
import { recordAuditLog, type Db } from "@maia/db";
import type { ResolvedPluginSlashCommand } from "@maia/db";
import { buildPluginRunAuditEntry } from "./plugin-run-audit.js";
import type { AlwaysOnSupervisor } from "./always-on-supervisor.js";
import {
  SLASH_FAILURE_MESSAGE,
  type SlashReplyRegistry,
} from "./slash-reply-registry.js";
import type { PluginTokenRegistry } from "./token-registry.js";

function readSlashOptions(
  interaction: ChatInputCommandInteraction,
): SlashOptionValue[] {
  const options: SlashOptionValue[] = [];
  for (const option of interaction.options.data) {
    if (option.name === undefined) {
      continue;
    }
    if (option.user) {
      options.push({
        name: option.name,
        type: "user",
        value: {
          id: option.user.id,
          username: option.user.username,
        },
      });
      continue;
    }
    if (option.role) {
      options.push({
        name: option.name,
        type: "role",
        value: { id: option.role.id },
      });
      continue;
    }
    if (option.channel) {
      options.push({
        name: option.name,
        type: "channel",
        value: { id: option.channel.id },
      });
      continue;
    }
    if (option.value !== undefined && option.value !== null) {
      options.push({
        name: option.name,
        type: typeof option.value === "boolean" ? "boolean" : typeof option.value === "number" ? "integer" : "string",
        value: option.value as string | number | boolean,
      });
    }
  }
  return options;
}

export interface ExecuteSlashRunInput {
  db: Db;
  interaction: ChatInputCommandInteraction;
  resolved: ResolvedPluginSlashCommand;
  guildValues: Record<string, string>;
  tokenRegistry: PluginTokenRegistry;
  slashReplies: SlashReplyRegistry;
  pluginApiUrl: string;
  alwaysOnSupervisor: AlwaysOnSupervisor;
  log: (line: string) => void;
}

export async function executeSlashRun(input: ExecuteSlashRunInput) {
  const { interaction, resolved } = input;
  const guildId = interaction.guildId;
  const member = interaction.member;
  if (!guildId || !member || !("id" in member)) {
    return;
  }

  const ephemeral = resolved.command.visibility === "ephemeral";
  await interaction.deferReply({ ephemeral });

  const memberRef = {
    id: member.id,
    username:
      "user" in member && member.user
        ? member.user.username
        : null,
  };
  const options = readSlashOptions(interaction);
  const token = input.tokenRegistry.mintInvocationToken(
    guildId,
    resolved.pluginId,
  );

  input.slashReplies.register(token, {
    guildId,
    pluginId: resolved.pluginId,
    commandName: resolved.command.name,
    memberId: memberRef.id,
    ephemeral,
    replySent: false,
    editReply: async (content) => {
      await interaction.editReply({ content });
    },
  });

  const timeLimitMs = slashRunTimeLimitMs(resolved.invocationTimeLimitMs);
  let exitCode: number | null = 0;
  let timedOut = false;
  let replySent = false;

  const finish = async (success: boolean, errorMessage?: string) => {
    const pending = input.slashReplies.get(token);
    if (pending && !pending.replySent) {
      await pending.editReply(SLASH_FAILURE_MESSAGE);
    }
    input.slashReplies.remove(token);
    input.tokenRegistry.revoke(token);
    await recordAuditLog(
      input.db,
      buildPluginRunAuditEntry({
        guildId,
        pluginId: resolved.pluginId,
        trigger: "slash",
        memberId: memberRef.id,
        commandName: resolved.command.name,
        success: success && replySent,
        errorMessage,
      }),
    );
  };

  try {
    if (resolved.lifetime === "always-on") {
      const stdin = buildAlwaysOnSlashStdin({
        guildId,
        command: resolved.command.name,
        options,
        member: memberRef,
        replyToken: token,
      });
      input.alwaysOnSupervisor.writeStdin(resolved.pluginId, stdin);
      await waitForSlashReply(input.slashReplies, token, timeLimitMs, () => {
        replySent = input.slashReplies.get(token)?.replySent ?? false;
      });
      replySent = input.slashReplies.get(token)?.replySent ?? replySent;
      await finish(replySent, replySent ? undefined : SLASH_FAILURE_MESSAGE);
      return;
    }

    const pluginsDir = resolvePluginsDirectory();
    const cwd = path.join(pluginsDir, resolved.directoryName);
    const processEnv = buildPluginProcessEnvironment({
      guildValues: input.guildValues,
      pluginToken: token,
      pluginUrl: input.pluginApiUrl,
    });
    const stdin = buildSlashInvocationStdin({
      guildId,
      command: resolved.command.name,
      options,
      member: memberRef,
      replyToken: token,
    });

    const result = await runPluginProcess(
      {
        cwd,
        command: resolved.processCommand,
        env: processEnv,
        stdin,
        timeLimitMs,
      },
      {
        onStdout(chunk) {
          input.log(`[plugin:${resolved.pluginId}] ${chunk}`.replace(/\n$/, ""));
        },
        onStderr(chunk) {
          input.log(
            `[plugin:${resolved.pluginId}:stderr] ${chunk}`.replace(/\n$/, ""),
          );
        },
      },
    );
    exitCode = result.exitCode;
    timedOut = result.timedOut;
    replySent = input.slashReplies.get(token)?.replySent ?? false;

    const success =
      !timedOut && exitCode === 0 && replySent;
    let errorMessage: string | undefined;
    if (timedOut) {
      errorMessage = "Process exceeded slash run time limit";
    } else if (exitCode !== 0) {
      errorMessage = `Process exited with code ${exitCode ?? "null"}`;
    } else if (!replySent) {
      errorMessage = SLASH_FAILURE_MESSAGE;
    }
    await finish(success, errorMessage);
  } catch (error) {
    replySent = input.slashReplies.get(token)?.replySent ?? false;
    await finish(
      false,
      error instanceof Error ? error.message : "Slash run failed",
    );
  }
}

async function waitForSlashReply(
  registry: SlashReplyRegistry,
  token: string,
  timeoutMs: number,
  onPoll: () => void,
) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    onPoll();
    const pending = registry.get(token);
    if (pending?.replySent) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
