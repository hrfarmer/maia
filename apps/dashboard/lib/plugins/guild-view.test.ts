import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planAlwaysOnConfigNotifications } from "./always-on-notify.js";
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

  it("shows cron control only for invocation plugins", () => {
    const invocation = mergeGuildPluginRow({
      plugin: {
        id: "1",
        directoryName: "role-sync",
        status: "ok",
        pluginId: "role-sync",
        displayName: "Role sync",
        lifetime: "invocation",
        subscribedEvents: [],
        errorMessage: null,
        environment: [],
      },
      enabled: false,
      storedValues: new Map(),
    });
    assert.equal(invocation.showCronControl, true);

    const alwaysOn = mergeGuildPluginRow({
      plugin: {
        id: "2",
        directoryName: "welcome-bot",
        status: "ok",
        pluginId: "welcome-bot",
        displayName: "Welcome bot",
        lifetime: "always-on",
        subscribedEvents: [],
        errorMessage: null,
        environment: [],
      },
      enabled: false,
      storedValues: new Map(),
    });
    assert.equal(alwaysOn.showCronControl, false);
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

  it("shows slash control when the manifest declares commands", () => {
    const row = mergeGuildPluginRow({
      plugin: {
        id: "1",
        directoryName: "slash-demo",
        status: "ok",
        pluginId: "slash-demo",
        displayName: "Slash demo",
        lifetime: "invocation",
        subscribedEvents: [],
        errorMessage: null,
        environment: [],
      },
      enabled: true,
      storedValues: new Map(),
      slashCommands: [{ name: "ping", description: "Ping", visibility: "public", defaultPermission: null, options: [] }],
      slashCommandsEnabled: true,
    });
    assert.equal(row.showSlashControl, true);
    assert.equal(row.slashCommandsEnabled, true);
  });

  it("turns slash publishing off when enablement is cleared", () => {
    const row = mergeGuildPluginRow({
      plugin: {
        id: "1",
        directoryName: "slash-demo",
        status: "ok",
        pluginId: "slash-demo",
        displayName: "Slash demo",
        lifetime: "invocation",
        subscribedEvents: [],
        errorMessage: null,
        environment: [{ key: "TOKEN", required: true, secret: true }],
      },
      enabled: true,
      storedValues: new Map(),
      slashCommands: [{ name: "ping", description: "Ping", visibility: "public", defaultPermission: null, options: [] }],
      slashCommandsEnabled: true,
    });
    assert.equal(row.slashCommandsEnabled, false);
  });

  it("plans always-on stdin notifications without restarting the process", () => {
    assert.deepEqual(
      planAlwaysOnConfigNotifications({
        lifetime: "always-on",
        previousEnabled: false,
        nextEnabled: true,
        valuesChanged: true,
      }),
      ["enabled"],
    );
    assert.deepEqual(
      planAlwaysOnConfigNotifications({
        lifetime: "always-on",
        previousEnabled: true,
        nextEnabled: true,
        valuesChanged: true,
      }),
      ["values_saved"],
    );
    assert.deepEqual(
      planAlwaysOnConfigNotifications({
        lifetime: "invocation",
        previousEnabled: false,
        nextEnabled: true,
        valuesChanged: true,
      }),
      [],
    );
  });
});
