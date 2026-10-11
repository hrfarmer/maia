import { Events, type Client } from "discord.js";
import type { MemberRolePluginEvent } from "@maia/plugins";
import { deliverMemberRoleGatewayEvent } from "./deliver-gateway-event.js";
import type { PluginEventInvocationConcurrency } from "./event-invocation-concurrency.js";
import { serializeDiscordPayload } from "./serialize-discord-payload.js";
import type { AlwaysOnSupervisor } from "./always-on-supervisor.js";
import type { PluginTokenRegistry } from "./token-registry.js";
import type { Db } from "@maia/db";

export interface RegisterMemberRoleEventsInput {
  client: Client;
  db: Db;
  alwaysOnSupervisor: AlwaysOnSupervisor;
  tokenRegistry: PluginTokenRegistry;
  pluginApiUrl: string;
  concurrency: PluginEventInvocationConcurrency;
  log?: (line: string) => void;
  deliver?: typeof deliverMemberRoleGatewayEvent;
}

function guildIdFromPayload(payload: unknown): string | null {
  if (payload === null || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.guildId === "string") {
    return record.guildId;
  }
  if (record.guild && typeof record.guild === "object") {
    const guild = record.guild as Record<string, unknown>;
    if (typeof guild.id === "string") {
      return guild.id;
    }
  }
  return null;
}

async function emitMemberRoleEvent(
  input: RegisterMemberRoleEventsInput,
  event: MemberRolePluginEvent,
  payload: unknown,
  guildId: string | null,
) {
  const resolvedGuildId = guildId ?? guildIdFromPayload(payload);
  if (!resolvedGuildId) {
    return;
  }
  const deliver = input.deliver ?? deliverMemberRoleGatewayEvent;
  await deliver({
    db: input.db,
    guildId: resolvedGuildId,
    event,
    payload: serializeDiscordPayload(payload),
    alwaysOnSupervisor: input.alwaysOnSupervisor,
    tokenRegistry: input.tokenRegistry,
    pluginApiUrl: input.pluginApiUrl,
    concurrency: input.concurrency,
    log: input.log ?? console.log,
  });
}

export function registerMemberRoleGatewayEvents(
  input: RegisterMemberRoleEventsInput,
) {
  const { client } = input;

  client.on(Events.GuildMemberAdd, (member) => {
    void emitMemberRoleEvent(input, "member.join", member, member.guild.id);
  });

  client.on(Events.GuildMemberRemove, (member) => {
    void emitMemberRoleEvent(input, "member.leave", member, member.guild.id);
  });

  client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
    void emitMemberRoleEvent(
      input,
      "member.update",
      { oldMember, newMember },
      newMember.guild.id,
    );
  });

  client.on(Events.GuildRoleCreate, (role) => {
    void emitMemberRoleEvent(input, "role.create", role, role.guild.id);
  });

  client.on(Events.GuildRoleUpdate, (oldRole, newRole) => {
    void emitMemberRoleEvent(
      input,
      "role.update",
      { oldRole, newRole },
      newRole.guild.id,
    );
  });

  client.on(Events.GuildRoleDelete, (role) => {
    void emitMemberRoleEvent(input, "role.delete", role, role.guild.id);
  });
}
