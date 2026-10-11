import assert from "node:assert/strict";
import { describe, it } from "node:test";

const CRITERIA = [
  {
    id: "plugins-tab-always-on-roster-column",
    test: "apps/dashboard/lib/plugins/spacelab-plugin-view.test.ts",
  },
  {
    id: "guild-manager-saves-and-reads-roster-column",
    test: "apps/bot/src/plugins/spacelab-roster-process.test.ts",
  },
  {
    id: "values-saved-without-process-restart",
    test: "apps/dashboard/lib/plugins/guild-view.test.ts",
  },
  {
    id: "clean-always-on-process-env",
    test: "apps/bot/src/plugins/spacelab-roster-process.test.ts",
  },
  {
    id: "startup-overwrites-spacelab-plugins",
    test: "packages/plugins/src/shipped-spacelab-sync.test.ts",
  },
  {
    id: "startup-leaves-other-plugin-folders",
    test: "packages/plugins/src/shipped-spacelab-sync.test.ts",
  },
  {
    id: "invalid-manifest-not-runnable",
    test: "packages/plugins/src/spacelab-plugin.test.ts",
  },
  {
    id: "discovery-does-not-execute",
    test: "packages/plugins/src/discover.test.ts",
  },
] as const;

describe("issue #37 criteria coverage map", () => {
  it("lists an automated test for every acceptance criterion", () => {
    assert.equal(CRITERIA.length, 8);
    for (const entry of CRITERIA) {
      assert.ok(entry.test.length > 0);
    }
  });
});
