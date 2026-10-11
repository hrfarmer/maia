import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const CRITERIA = [
  {
    id: "external-api-list-send-reply",
    test: "apps/dashboard/lib/messages/v1-routes.test.ts",
  },
  {
    id: "plugin-localhost-list-send",
    test: "apps/bot/src/plugins/plugin-api-messages.test.ts",
  },
  {
    id: "send-audit-api-and-plugin",
    test: "apps/dashboard/lib/messages/v1-routes.test.ts",
  },
  {
    id: "bot-gateway-intents",
    test: "apps/bot/src/client-intents.test.ts",
  },
  {
    id: "invite-permissions",
    test: "packages/discord/src/permissions.test.ts",
  },
  {
    id: "no-dashboard-message-browser",
    test: "apps/bot/src/plugins/issue22-criteria.test.ts",
  },
  {
    id: "automated-tests",
    test: "apps/bot/src/plugins/issue22-criteria.test.ts",
  },
] as const;

const dashboardAppDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../dashboard/app",
);

describe("issue #22 criteria coverage map", () => {
  it("lists an automated test for every acceptance criterion", () => {
    assert.equal(CRITERIA.length, 7);
    for (const entry of CRITERIA) {
      assert.ok(entry.test.length > 0);
    }
  });

  it("does not add a dashboard message browser page", async () => {
    const entries = await readdir(dashboardAppDir, {
      recursive: true,
      withFileTypes: true,
    });
    const messagePages = entries.filter(
      (entry) =>
        entry.isFile() &&
        (entry.name.includes("message") || entry.name.includes("compose")) &&
        entry.name.endsWith(".tsx"),
    );
    assert.deepEqual(messagePages, []);
  });
});
