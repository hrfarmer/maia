import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGuildPluginEnvironmentFields,
  mergeGuildPluginRow,
} from "./guild-view.js";

describe("Space Lab roster plugins tab row", () => {
  const scanPlugin = {
    id: "scan-1",
    directoryName: "spacelab-plugins",
    status: "ok" as const,
    pluginId: "spacelab-roster",
    displayName: "Space Lab roster",
    lifetime: "always-on",
    subscribedEvents: [] as string[],
    errorMessage: null,
    environment: [{ key: "ROSTER_COLUMN", required: true, secret: false }],
  };

  it("shows always-on Space Lab roster with no events and required ROSTER_COLUMN", () => {
    const row = mergeGuildPluginRow({
      plugin: scanPlugin,
      enabled: false,
      storedValues: new Map(),
    });
    assert.equal(row.displayName, "Space Lab roster");
    assert.equal(row.lifetime, "always-on");
    assert.deepEqual(row.subscribedEvents, []);
    assert.equal(row.environment[0]?.key, "ROSTER_COLUMN");
    assert.equal(row.environment[0]?.required, true);
    assert.equal(row.environment[0]?.secret, false);
    assert.equal(row.showCronControl, false);
  });

  it("shows saved non-secret ROSTER_COLUMN values to guild managers", () => {
    const fields = buildGuildPluginEnvironmentFields(
      scanPlugin.environment,
      new Map([["ROSTER_COLUMN", "LabRole"]]),
    );
    assert.equal(fields[0]?.value, "LabRole");
    assert.equal(fields[0]?.secret, false);
  });
});
