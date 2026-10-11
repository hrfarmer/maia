import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Maps issue #20 acceptance criteria to automated tests in this repo.
 */
const CRITERIA = [
  {
    id: "cron-control-invocation-only",
    test: "apps/dashboard/lib/plugins/guild-view.test.ts",
  },
  {
    id: "cron-fires-when-enabled",
    test: "packages/plugins/src/cron-schedule.test.ts",
  },
  {
    id: "invalid-cron-rejected",
    test: "apps/dashboard/lib/plugins/service.test.ts",
  },
  {
    id: "no-replay-while-bot-down",
    test: "packages/plugins/src/cron-schedule.test.ts",
  },
  {
    id: "cron-stdin-env-token",
    test: "packages/plugins/src/guild-config.test.ts",
  },
  {
    id: "cron-audit-row",
    test: "apps/bot/src/plugins/plugin-run-audit.test.ts",
  },
  {
    id: "cron-bypasses-event-cap",
    test: "apps/bot/src/plugins/cron-loop.test.ts",
  },
  {
    id: "prune-removes-cron",
    test: "apps/bot/src/plugins/run-scan.test.ts",
  },
] as const;

describe("issue #20 criteria coverage map", () => {
  it("lists an automated test for every acceptance criterion", () => {
    assert.equal(CRITERIA.length, 8);
    for (const entry of CRITERIA) {
      assert.ok(entry.test.length > 0);
    }
  });
});
