import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPluginGatewayEventStdin,
  listPluginsSubscribedToEvent,
  resolveMaxConcurrentInvocations,
} from "./gateway-event-delivery.js";
import { DEFAULT_MAX_CONCURRENT_INVOCATIONS } from "./manifest.js";

describe("buildPluginGatewayEventStdin", () => {
  it("names guild, event, and payload on one line", () => {
    assert.equal(
      buildPluginGatewayEventStdin("999", "member.join", { userId: "1" }),
      '{"guildId":"999","event":"member.join","payload":{"userId":"1"}}\n',
    );
  });
});

describe("listPluginsSubscribedToEvent", () => {
  it("returns enabled plugins subscribed to the event", () => {
    const targets = listPluginsSubscribedToEvent(
      [
        {
          pluginId: "a",
          lifetime: "invocation",
          subscribedEvents: ["member.join"],
        },
        {
          pluginId: "b",
          lifetime: "always-on",
          subscribedEvents: ["member.leave"],
        },
      ],
      ["a", "b"],
      "member.join",
    );
    assert.deepEqual(targets.map((plugin) => plugin.pluginId), ["a"]);
  });
});

describe("resolveMaxConcurrentInvocations", () => {
  it("defaults to 8 for invocation plugins", () => {
    assert.equal(
      resolveMaxConcurrentInvocations({
        lifetime: "invocation",
        maxConcurrentInvocations: null,
      }),
      DEFAULT_MAX_CONCURRENT_INVOCATIONS,
    );
  });

  it("uses manifest value when set", () => {
    assert.equal(
      resolveMaxConcurrentInvocations({
        lifetime: "invocation",
        maxConcurrentInvocations: 2,
      }),
      2,
    );
  });
});
