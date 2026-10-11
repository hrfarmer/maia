import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyGuildPluginValuePatch,
  buildGuildPluginEnvironmentFields,
  mergeGuildPluginRow,
} from "./guild-view.js";

describe("guild plugin view", () => {
  const environment = [
    { key: "WEBHOOK_URL", required: true, secret: false },
    { key: "API_SECRET", required: true, secret: true },
  ];

  it("shows non-secret values and hides saved secrets", () => {
    const fields = buildGuildPluginEnvironmentFields(
      environment,
      new Map([
        ["WEBHOOK_URL", "https://example.com"],
        ["API_SECRET", "hidden"],
      ]),
    );
    assert.equal(fields[0]?.value, "https://example.com");
    assert.equal(fields[1]?.value, null);
    assert.equal(fields[1]?.hasSecretValue, true);
  });

  it("offers Run now only for enabled invocation plugins", () => {
    const enabled = mergeGuildPluginRow({
      plugin: {
        id: "1",
        directoryName: "role-sync",
        status: "ok",
        pluginId: "role-sync",
        displayName: "Role sync",
        lifetime: "invocation",
        subscribedEvents: [],
        errorMessage: null,
        environment,
      },
      enabled: true,
      storedValues: new Map([
        ["WEBHOOK_URL", "https://example.com"],
        ["API_SECRET", "s"],
      ]),
    });
    assert.equal(enabled.canRunNow, true);

    const disabled = mergeGuildPluginRow({
      plugin: {
        id: "1",
        directoryName: "role-sync",
        status: "ok",
        pluginId: "role-sync",
        displayName: "Role sync",
        lifetime: "invocation",
        subscribedEvents: [],
        errorMessage: null,
        environment,
      },
      enabled: false,
      storedValues: new Map([
        ["WEBHOOK_URL", "https://example.com"],
        ["API_SECRET", "s"],
      ]),
    });
    assert.equal(disabled.canRunNow, false);
  });

  it("clears enablement when a required value is removed", () => {
    const result = applyGuildPluginValuePatch({
      environment,
      existingValues: new Map([
        ["WEBHOOK_URL", "https://example.com"],
        ["API_SECRET", "s"],
      ]),
      patch: { WEBHOOK_URL: null },
      requestedEnabled: true,
    });
    assert.equal(result.enabled, false);
    assert.equal(result.values.has("WEBHOOK_URL"), false);
  });
});
