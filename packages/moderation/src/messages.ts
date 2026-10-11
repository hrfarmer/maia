import { Permission, hasPermission } from "@maia/discord";
import { getDb, recordAuditLog } from "@maia/db";
import {
  type DiscordGuildChannel,
  PLAIN_TEXT_GUILD_CHANNEL_TYPES,
  botCanSendMessages,
  botCanViewChannel,
} from "./channel-permissions.js";
import {
  DiscordApiError,
  createChannelMessage,
  fetchGuildChannels,
  fetchGuildMember,
  fetchGuildRoles,
  getBotUserId,
  type DiscordGuildMember,
} from "./discord-bot.js";
import { ModerationError } from "./hierarchy.js";
import type { ParsedMessageSend } from "./message-send.js";
import { computeGuildPermissions } from "./role-create.js";
import type { ModerationActor } from "./service.js";

export interface GuildChannelSummary {
  id: string;
  name: string;
  type: number;
}

async function loadBotGuildContext(guildId: string) {
  const [roles, botUserId, channels] = await Promise.all([
    fetchGuildRoles(guildId),
    getBotUserId(),
    fetchGuildChannels(guildId),
  ]);
  const botMember = await fetchGuildMember(guildId, botUserId);
  const channelsById = new Map(channels.map((channel) => [channel.id, channel]));
  return { roles, botUserId, botMember, channels, channelsById };
}

function actorReason(actor: ModerationActor): string | undefined {
  if (!actor.label) {
    if (actor.source === "plugin") {
      return `Maia plugin ${actor.id}`;
    }
    return undefined;
  }
  if (actor.source === "api") {
    return `Maia API key "${actor.label}"`;
  }
  if (actor.source === "dashboard") {
    return `Maia dashboard by ${actor.label}`;
  }
  if (actor.source === "plugin") {
    return `Maia plugin "${actor.label}"`;
  }
  return actor.label;
}

async function auditMessageSend(
  actor: ModerationActor,
  guildId: string,
  input: {
    targetId: string;
    detail?: Record<string, unknown>;
    success: boolean;
    errorMessage?: string;
  },
) {
  await recordAuditLog(getDb(), {
    guildId,
    source: actor.source,
    actorId: actor.id,
    actorLabel: actor.label,
    action: "message.send",
    targetType: "message",
    targetId: input.targetId,
    detail: input.detail,
    success: input.success,
    errorMessage: input.errorMessage,
  });
}

function mapDiscordError(error: unknown): never {
  if (error instanceof ModerationError) {
    throw error;
  }
  if (error instanceof DiscordApiError) {
    if (error.status === 404) {
      throw new ModerationError("Discord resource not found.");
    }
    throw new ModerationError(error.message);
  }
  throw error;
}

export async function listViewableGuildChannels(
  guildId: string,
): Promise<GuildChannelSummary[]> {
  const ctx = await loadBotGuildContext(guildId);
  const guildPerms = computeGuildPermissions(
    ctx.botMember,
    ctx.roles,
    guildId,
  );
  const admin = hasPermission(guildPerms, Permission.Administrator);

  const viewable: GuildChannelSummary[] = [];
  for (const channel of ctx.channels) {
    if (!PLAIN_TEXT_GUILD_CHANNEL_TYPES.has(channel.type)) {
      continue;
    }
    const canView =
      admin ||
      botCanViewChannel(
        ctx.botMember,
        channel,
        ctx.roles,
        guildId,
        ctx.botUserId,
        ctx.channelsById,
      );
    if (!canView) {
      continue;
    }
    viewable.push({ id: channel.id, name: channel.name, type: channel.type });
  }

  viewable.sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
  );
  return viewable;
}

function findGuildChannel(
  channels: DiscordGuildChannel[],
  channelId: string,
): DiscordGuildChannel {
  const channel = channels.find((item) => item.id === channelId);
  if (!channel) {
    throw new ModerationError("Channel not found in this guild.");
  }
  if (!PLAIN_TEXT_GUILD_CHANNEL_TYPES.has(channel.type)) {
    throw new ModerationError("Only plain-text guild channels are supported.");
  }
  return channel;
}

export async function sendGuildChannelMessage(
  guildId: string,
  channelId: string,
  input: ParsedMessageSend,
  actor: ModerationActor,
) {
  try {
    const ctx = await loadBotGuildContext(guildId);
    const channel = findGuildChannel(ctx.channels, channelId);
    const guildPerms = computeGuildPermissions(
      ctx.botMember,
      ctx.roles,
      guildId,
    );
    const admin = hasPermission(guildPerms, Permission.Administrator);
    const canSend =
      admin ||
      botCanSendMessages(
        ctx.botMember,
        channel,
        ctx.roles,
        guildId,
        ctx.botUserId,
        ctx.channelsById,
      );
    if (!canSend) {
      throw new ModerationError(
        "Maia cannot send messages in that channel.",
      );
    }

    const created = await createChannelMessage(channelId, {
      content: input.content,
      replyToMessageId: input.replyToMessageId,
      reason: actorReason(actor),
    });

    await auditMessageSend(actor, guildId, {
      targetId: created.id,
      detail: {
        channelId,
        content: input.content,
        replyToMessageId: input.replyToMessageId,
      },
      success: true,
    });

    return {
      ok: true as const,
      message: {
        id: created.id,
        channelId,
        content: created.content ?? input.content,
      },
    };
  } catch (error) {
    await auditMessageSend(actor, guildId, {
      targetId: channelId,
      detail: {
        channelId,
        content: input.content,
        replyToMessageId: input.replyToMessageId,
      },
      success: false,
      errorMessage: error instanceof Error ? error.message : "Failed",
    }).catch(() => undefined);
    mapDiscordError(error);
  }
}
