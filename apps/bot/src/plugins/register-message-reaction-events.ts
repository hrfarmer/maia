import { Events, type Client } from "discord.js";
import type { MessageReactionPluginEvent } from "@maia/plugins";
import { deliverAlwaysOnGatewayEvent } from "./deliver-gateway-event.js";
import { serializeDiscordPayload } from "./serialize-discord-payload.js";
import type { AlwaysOnSupervisor } from "./always-on-supervisor.js";
import type { Db } from "@maia/db";

export interface RegisterMessageReactionEventsInput {
  client: Client;
  db: Db;
  alwaysOnSupervisor: AlwaysOnSupervisor;
  deliver?: typeof deliverAlwaysOnGatewayEvent;
}

function guildIdFromReactionMessage(message: {
  guild: { id: string } | null;
}): string | null {
  return message.guild?.id ?? null;
}

async function emitMessageReactionEvent(
  input: RegisterMessageReactionEventsInput,
  event: MessageReactionPluginEvent,
  payload: unknown,
  guildId: string | null,
) {
  if (!guildId) {
    return;
  }
  const deliver = input.deliver ?? deliverAlwaysOnGatewayEvent;
  await deliver({
    db: input.db,
    guildId,
    event,
    payload: serializeDiscordPayload(payload),
    alwaysOnSupervisor: input.alwaysOnSupervisor,
  });
}

export function registerMessageReactionGatewayEvents(
  input: RegisterMessageReactionEventsInput,
) {
  const { client } = input;

  client.on(Events.MessageCreate, (message) => {
    if (!message.guild) {
      return;
    }
    void emitMessageReactionEvent(
      input,
      "message.created",
      message,
      message.guild.id,
    );
  });

  client.on(Events.MessageReactionAdd, (reaction, user) => {
    void emitMessageReactionEvent(
      input,
      "reaction.added",
      { reaction, user },
      guildIdFromReactionMessage(reaction.message),
    );
  });

  client.on(Events.MessageReactionRemove, (reaction, user) => {
    void emitMessageReactionEvent(
      input,
      "reaction.removed",
      { reaction, user },
      guildIdFromReactionMessage(reaction.message),
    );
  });
}
