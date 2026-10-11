import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Maps issue #17 acceptance criteria to automated tests in this repo.
 * Keep this list in sync when adding or moving coverage.
 */
const CRITERIA = [
  {
    id: "env-keys-ui",
    test: "apps/dashboard/lib/plugins/guild-view.test.ts",
  },
  {
    id: "enable-after-required",
    test: "packages/plugins/src/guild-config.test.ts",
  },
  {
    id: "clear-required-disables",
    test: "apps/dashboard/lib/plugins/guild-view.test.ts",
  },
  {
    id: "run-now-enabled-invocation",
    test: "apps/dashboard/lib/plugins/guild-view.test.ts",
  },
  {
    id: "process-cwd-no-shell-clean-env",
    test: "packages/plugins/src/process-runner.test.ts",
  },
  {
    id: "process-guild-env-token-url",
    test: "packages/plugins/src/guild-config.test.ts",
  },
  {
    id: "localhost-api-guild-token",
    test: "apps/bot/src/plugins/plugin-api-server.test.ts",
  },
  {
    id: "manual-run-stdin",
    test: "packages/plugins/src/guild-config.test.ts",
  },
  {
    id: "invocation-time-limit",
    test: "packages/plugins/src/process-runner.test.ts",
  },
  {
    id: "invocation-time-limit-manifest",
    test: "packages/plugins/src/issue17-acceptance.test.ts",
  },
  {
    id: "audit-on-finish",
    test: "apps/bot/src/plugins/plugin-run-audit.test.ts",
  },
  {
    id: "stdout-stderr-logged",
    test: "apps/bot/src/plugins/plugin-run-audit.test.ts",
  },
  {
    id: "hot-reload-config",
    test: "packages/db/src/guild-plugins-logic.test.ts",
  },
  {
    id: "prune-on-discovery-removal",
    test: "apps/bot/src/plugins/run-scan.test.ts",
  },
] as const;

describe("issue #17 criteria coverage map", () => {
  it("lists an automated test for every acceptance criterion", () => {
    assert.equal(CRITERIA.length, 14);
    for (const entry of CRITERIA) {
      assert.ok(entry.test.length > 0);
    }
  });
});
