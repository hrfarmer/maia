import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePluginManifest, PluginManifestError } from "./manifest.js";
import { validManifest } from "./test-helpers.js";

describe("parsePluginManifest", () => {
  it("accepts a valid always-on manifest", () => {
    assert.deepEqual(parsePluginManifest(validManifest()), {
      id: "demo",
      name: "Demo plugin",
      lifetime: "always-on",
      subscribedEvents: ["member.join"],
      command: ["node", "index.js"],
      environment: [],
      invocationTimeLimitMs: null,
      maxConcurrentInvocations: null,
      slashCommands: [],
    });
  });

  it("accepts invocation maxConcurrentInvocations and rejects it on always-on", () => {
    assert.deepEqual(
      parsePluginManifest(
        validManifest({
          lifetime: "invocation",
          maxConcurrentInvocations: 2,
        }),
      ).maxConcurrentInvocations,
      2,
    );
    assert.throws(
      () =>
        parsePluginManifest(
          validManifest({ maxConcurrentInvocations: 2 }),
        ),
      (error: unknown) =>
        error instanceof PluginManifestError &&
        error.message.includes("maxConcurrentInvocations"),
    );
  });

  it("rejects unreadable manifest shape", () => {
    assert.throws(
      () => parsePluginManifest(null),
      (error: unknown) =>
        error instanceof PluginManifestError &&
        error.message === "manifest must be a JSON object",
    );
  });

  it("rejects a missing command", () => {
    assert.throws(
      () => parsePluginManifest(validManifest({ command: [] })),
      (error: unknown) =>
        error instanceof PluginManifestError &&
        error.message === "command is required",
    );
  });

  it("rejects an unknown lifetime", () => {
    assert.throws(
      () => parsePluginManifest(validManifest({ lifetime: "cron" })),
      (error: unknown) =>
        error instanceof PluginManifestError &&
        error.message.includes("lifetime must be"),
    );
  });

  it("rejects an unknown event", () => {
    assert.throws(
      () =>
        parsePluginManifest(
          validManifest({ subscribedEvents: ["member.teleport"] }),
        ),
      (error: unknown) =>
        error instanceof PluginManifestError &&
        error.message === "unknown event: member.teleport",
    );
  });

  it("rejects invocation plugins that subscribe to message or reaction events", () => {
    assert.throws(
      () =>
        parsePluginManifest(
          validManifest({
            lifetime: "invocation",
            subscribedEvents: ["message.created"],
          }),
        ),
      (error: unknown) =>
        error instanceof PluginManifestError &&
        error.message.includes("invocation plugins cannot subscribe"),
    );
  });

  it("rejects reserved environment keys", () => {
    assert.throws(
      () =>
        parsePluginManifest(
          validManifest({
            environment: [{ key: "MAIA_PLUGIN_TOKEN", required: true }],
          }),
        ),
      (error: unknown) =>
        error instanceof PluginManifestError &&
        error.message.includes("MAIA_PLUGIN_TOKEN"),
    );
  });
});
