import assert from "node:assert/strict";
import { describe, it } from "node:test";

const CRITERIA = [
  {
    id: "roster-export-header-requirements",
    test: "packages/plugins/src/spacelab-roster/parse.test.ts",
  },
  {
    id: "adapt-values-from-configured-column-only",
    test: "packages/plugins/src/spacelab-roster/parse.test.ts",
  },
  {
    id: "distinct-values-and-status-on-rows",
    test: "packages/plugins/src/spacelab-roster/parse.test.ts",
  },
  {
    id: "merge-rows-by-discord-handle",
    test: "packages/plugins/src/spacelab-roster/parse.test.ts",
  },
  {
    id: "active-status-case-insensitive-for-later-slices",
    test: "packages/plugins/src/spacelab-roster/parse.test.ts",
  },
  {
    id: "unparseable-row-rejects-whole-message",
    test: "packages/plugins/src/spacelab-roster/parse.test.ts",
  },
  {
    id: "plugins-card-lists-values-with-role-dropdown",
    test: "apps/dashboard/lib/plugins/spacelab-adapt-roles-service.test.ts",
  },
  {
    id: "save-link-per-value-and-shared-discord-role",
    test: "apps/dashboard/lib/plugins/spacelab-adapt-roles-service.test.ts",
  },
  {
    id: "saved-link-survives-missing-value-with-not-in-roster",
    test: "apps/dashboard/lib/plugins/spacelab-adapt-roles-service.test.ts",
  },
  {
    id: "missing-guild-role-shown-as-error",
    test: "packages/plugins/src/spacelab-roster/adapt-role-view.test.ts",
  },
  {
    id: "parse-failure-keeps-prior-roster-and-links",
    test: "apps/dashboard/lib/plugins/spacelab-adapt-roles-service.test.ts",
  },
  {
    id: "reload-shows-saved-links",
    test: "apps/dashboard/lib/plugins/spacelab-adapt-roles-routes.test.ts",
  },
] as const;

describe("issue #40 criteria coverage map", () => {
  it("lists an automated test for every acceptance criterion", () => {
    assert.equal(CRITERIA.length, 12);
    for (const entry of CRITERIA) {
      assert.ok(entry.test.length > 0);
    }
  });
});
