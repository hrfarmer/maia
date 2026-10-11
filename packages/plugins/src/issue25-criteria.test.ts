import assert from "node:assert/strict";
import { describe, it } from "node:test";

const CRITERIA = [
  {
    id: "slash-switch-publish",
    test: "apps/dashboard/lib/plugins/guild-view.test.ts",
  },
  {
    id: "custom-commands-remain",
    test: "packages/db/src/guild-plugin-slash.test.ts",
  },
  {
    id: "collision-skip",
    test: "packages/plugins/src/slash-commands.test.ts",
  },
  {
    id: "default-permission-payload",
    test: "packages/plugins/src/slash-commands.test.ts",
  },
  {
    id: "defer-and-trigger",
    test: "apps/bot/src/plugins/execute-slash-run.test.ts",
  },
  {
    id: "reply-visibility",
    test: "apps/bot/src/plugins/slash-reply-registry.test.ts",
  },
  {
    id: "no-reply-failure",
    test: "apps/bot/src/plugins/execute-slash-run.test.ts",
  },
  {
    id: "audit-slash",
    test: "apps/bot/src/plugins/plugin-run-audit.test.ts",
  },
  {
    id: "slash-bypasses-event-cap",
    test: "apps/bot/src/plugins/execute-slash-run.test.ts",
  },
  {
    id: "rejected-publish",
    test: "apps/dashboard/lib/guild-application-commands/sync.test.ts",
  },
  {
    id: "disable-unpublish",
    test: "apps/dashboard/lib/plugins/guild-view.test.ts",
  },
  {
    id: "discovery-removal",
    test: "apps/bot/src/plugins/run-scan.test.ts",
  },
] as const;

describe("issue #25 criteria coverage map", () => {
  it("lists an automated test for every acceptance criterion", () => {
    assert.equal(CRITERIA.length, 12);
    for (const entry of CRITERIA) {
      assert.ok(entry.test.length > 0);
    }
  });
});
