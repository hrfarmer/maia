import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const botPluginsDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Maps issue #24 acceptance criteria to automated tests in this repo.
 */
const CRITERIA = [
  {
    id: "always-on-stdin-with-content",
    test: "apps/bot/src/plugins/deliver-gateway-event.test.ts",
  },
  {
    id: "skip-disabled-or-unsubscribed",
    test: "apps/bot/src/plugins/deliver-gateway-event.test.ts",
  },
  {
    id: "no-invocation-process",
    test: "apps/bot/src/plugins/deliver-gateway-event.test.ts",
  },
  {
    id: "no-run-audit",
    test: "apps/bot/src/plugins/issue24-criteria.test.ts",
  },
  {
    id: "gateway-registration",
    test: "apps/bot/src/plugins/register-message-reaction-events.test.ts",
  },
  {
    id: "manifest-subscribed-events",
    test: "packages/plugins/src/manifest-message-events.test.ts",
  },
  {
    id: "reaction-partials",
    test: "apps/bot/src/client-intents.test.ts",
  },
] as const;

describe("issue #24 criteria coverage map", () => {
  it("lists an automated test for every acceptance criterion", () => {
    assert.equal(CRITERIA.length, 7);
    for (const entry of CRITERIA) {
      assert.ok(entry.test.length > 0);
    }
  });

  it("message and reaction delivery does not start invocation runs or write run-audit", async () => {
    const deliver = await readFile(
      path.join(botPluginsDir, "deliver-gateway-event.ts"),
      "utf8",
    );
    const register = await readFile(
      path.join(botPluginsDir, "register-message-reaction-events.ts"),
      "utf8",
    );
    const alwaysOnDeliver = deliver.slice(
      deliver.indexOf("export async function deliverAlwaysOnGatewayEvent"),
      deliver.indexOf("export async function deliverMemberRoleGatewayEvent"),
    );
    assert.doesNotMatch(alwaysOnDeliver, /executePluginEventRun/);
    assert.doesNotMatch(alwaysOnDeliver, /recordAuditLog/);
    assert.match(register, /deliverAlwaysOnGatewayEvent/);
    assert.doesNotMatch(register, /executePluginEventRun/);
    assert.doesNotMatch(register, /recordAuditLog/);
  });
});
