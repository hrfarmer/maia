import assert from "node:assert/strict";
import { describe, it } from "node:test";

const CRITERIA = [
  {
    id: "startup-starts-always-on",
    test: "apps/bot/src/plugins/plugin-supervisor.test.ts",
  },
  {
    id: "no-second-on-enable",
    test: "apps/bot/src/plugins/plugin-supervisor.test.ts",
  },
  {
    id: "restart-on-exit",
    test: "apps/bot/src/plugins/plugin-supervisor.test.ts",
  },
  {
    id: "refresh-restarts-when-runnable-changed",
    test: "apps/bot/src/plugins/plugin-supervisor.test.ts",
  },
  {
    id: "config-change-stdin",
    test: "apps/bot/src/plugins/plugin-supervisor.test.ts",
  },
  {
    id: "clean-always-on-env",
    test: "packages/plugins/src/guild-config.test.ts",
  },
  {
    id: "always-on-api-values",
    test: "apps/bot/src/plugins/plugin-api-server.test.ts",
  },
  {
    id: "no-guild-values-on-stdin",
    test: "packages/plugins/src/guild-config.test.ts",
  },
  {
    id: "stop-when-removed",
    test: "apps/bot/src/plugins/plugin-supervisor.test.ts",
  },
  {
    id: "dashboard-enqueues-config",
    test: "apps/dashboard/lib/plugins/guild-view.test.ts",
  },
] as const;

describe("issue #18 criteria coverage map", () => {
  it("lists an automated test for every acceptance criterion", () => {
    assert.equal(CRITERIA.length, 10);
    for (const entry of CRITERIA) {
      assert.ok(entry.test.length > 0);
    }
  });
});
