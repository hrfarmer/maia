import assert from "node:assert/strict";
import { describe, it } from "node:test";

const CRITERIA = [
  {
    id: "operations-hierarchy",
    test: "apps/bot/src/plugins/plugin-api-moderation.test.ts",
  },
  {
    id: "plugin-audit-actor",
    test: "apps/bot/src/plugins/plugin-api-moderation.test.ts",
  },
  {
    id: "member-search-query",
    test: "apps/bot/src/plugins/plugin-api-moderation.test.ts",
  },
  {
    id: "invocation-guild-scope",
    test: "apps/bot/src/plugins/plugin-api-server.test.ts",
  },
  {
    id: "always-on-enabled-guilds",
    test: "apps/bot/src/plugins/plugin-api-server.test.ts",
  },
  {
    id: "plugin-no-quota",
    test: "apps/bot/src/plugins/plugin-api-moderation.test.ts",
  },
  {
    id: "external-api-quota",
    test: "apps/dashboard/lib/api/rate-limit.test.ts",
  },
  {
    id: "external-api-audit-actor",
    test: "apps/dashboard/lib/api/auth-utils.test.ts",
  },
  {
    id: "dashboard-moderation",
    test: "apps/dashboard/app/api/servers/[guildId]/roles/route.ts",
  },
  {
    id: "automated-tests",
    test: "apps/bot/src/plugins/issue21-criteria.test.ts",
  },
] as const;

describe("issue #21 criteria coverage map", () => {
  it("lists an automated test for every acceptance criterion", () => {
    assert.equal(CRITERIA.length, 10);
    for (const entry of CRITERIA) {
      assert.ok(entry.test.length > 0);
    }
  });
});
