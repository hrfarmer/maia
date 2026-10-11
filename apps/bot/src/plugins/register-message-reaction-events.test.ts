import assert from "node:assert/strict";
import EventEmitter from "node:events";
import { describe, it } from "node:test";
import { Events, type Client } from "discord.js";
import type { Db } from "@maia/db";
import type { AlwaysOnSupervisor } from "./always-on-supervisor.js";
import { registerMessageReactionGatewayEvents } from "./register-message-reaction-events.js";

function mockClient() {
  const emitter = new EventEmitter();
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const client = {
    on(event: string, handler: (...args: unknown[]) => void) {
      handlers.set(event, handler);
      emitter.on(event, handler);
    },
  } as unknown as Client;
  return {
    client,
    handlers,
    emit(event: string, ...args: unknown[]) {
      emitter.emit(event, ...args);
    },
  };
}

describe("registerMessageReactionGatewayEvents", () => {
  it("delivers guild message.created with serialized content", async () => {
    const mock = mockClient();
    const deliveries: Array<{ event: string; guildId: string; payload: unknown }> =
      [];
    registerMessageReactionGatewayEvents({
      client: mock.client,
      db: {} as Db,
      alwaysOnSupervisor: { writeStdin() {} } as unknown as AlwaysOnSupervisor,
      deliver: async (input) => {
        deliveries.push({
          event: input.event,
          guildId: input.guildId,
          payload: input.payload,
        });
      },
    });

    const handler = mock.handlers.get(Events.MessageCreate);
    assert.ok(handler);
    handler!({
      guild: { id: "777" },
      content: "hello guild",
      toJSON() {
        return { id: "m1", content: "hello guild", guild_id: "777" };
      },
    });

    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(deliveries, [
      {
        event: "message.created",
        guildId: "777",
        payload: { id: "m1", content: "hello guild", guild_id: "777" },
      },
    ]);
  });

  it("ignores DMs without a guild", async () => {
    const mock = mockClient();
    let deliveries = 0;
    registerMessageReactionGatewayEvents({
      client: mock.client,
      db: {} as Db,
      alwaysOnSupervisor: { writeStdin() {} } as unknown as AlwaysOnSupervisor,
      deliver: async () => {
        deliveries += 1;
      },
    });

    mock.handlers.get(Events.MessageCreate)!({
      guild: null,
      content: "dm",
      toJSON() {
        return { id: "m2", content: "dm" };
      },
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(deliveries, 0);
  });

  it("delivers reaction.added and reaction.removed for guild messages", async () => {
    const mock = mockClient();
    const events: string[] = [];
    registerMessageReactionGatewayEvents({
      client: mock.client,
      db: {} as Db,
      alwaysOnSupervisor: { writeStdin() {} } as unknown as AlwaysOnSupervisor,
      deliver: async (input) => {
        events.push(input.event);
      },
    });

    const reactionPayload = {
      message: { guild: { id: "888" } },
      emoji: { name: "thumbsup" },
      toJSON() {
        return { emoji: { name: "thumbsup" }, message_id: "m3" };
      },
    };
    const user = {
      id: "u9",
      toJSON() {
        return { id: "u9" };
      },
    };

    mock.handlers.get(Events.MessageReactionAdd)!(reactionPayload, user);
    mock.handlers.get(Events.MessageReactionRemove)!(reactionPayload, user);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(events, ["reaction.added", "reaction.removed"]);
  });
});
