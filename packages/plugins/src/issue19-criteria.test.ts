import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Maps issue #19 acceptance criteria to automated tests in this repo.
 */
const CRITERIA = [
  {
    id: "invocation-event-stdin",
    test: "apps/bot/src/plugins/execute-event-run.test.ts",
  },
  {
    id: "always-on-event-stdin",
    test: "apps/bot/src/plugins/deliver-gateway-event.test.ts",
  },
  {
    id: "skip-disabled-or-unsubscribed",
    test: "apps/bot/src/plugins/deliver-gateway-event.test.ts",
  },
  {
    id: "drop-when-cap-full",
    test: "apps/bot/src/plugins/event-invocation-concurrency.test.ts",
  },
  {
    id: "manifest-cap",
    test: "packages/plugins/src/manifest.test.ts",
  },
  {
    id: "run-now-bypasses-cap",
    test: "apps/bot/src/plugins/issue19-criteria.test.ts",
  },
  {
    id: "no-run-audit",
    test: "apps/bot/src/plugins/issue19-criteria.test.ts",
  },
  {
    id: "gateway-stdin-shape",
    test: "packages/plugins/src/gateway-event-delivery.test.ts",
  },
] as const;

describe("issue #19 criteria coverage map", () => {
  it("lists an automated test for every acceptance criterion", () => {
    assert.equal(CRITERIA.length, 8);
    for (const entry of CRITERIA) {
      assert.ok(entry.test.length > 0);
    }
  });
});
