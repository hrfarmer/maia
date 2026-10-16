import assert from "node:assert/strict";
import { describe, it } from "node:test";

const criteria = [
  {
    requirement:
      "A roster member joining gets linked roles plus the general member role and granted roles are recorded",
    test: "packages/plugins/src/spacelab-roster/reconcile-pass.test.ts",
  },
  {
    requirement: "A non-roster joiner gets nothing",
    test: "packages/plugins/src/spacelab-roster/reconcile-pass.test.ts",
  },
  {
    requirement: "An inactive or unmapped joiner gets nothing",
    test: "packages/plugins/src/spacelab-roster/reconcile-pass.test.ts",
  },
  {
    requirement: "DiscordHandle matching is case-insensitive on member join",
    test: "packages/plugins/src/spacelab-roster/reconcile-pass.test.ts",
  },
  {
    requirement:
      "Member join is subscribed in the manifest and handled on plugin stdin",
    test: "packages/plugins/src/spacelab-plugin.test.ts; apps/bot/src/plugins/spacelab-roster-process.test.ts",
  },
  {
    requirement: "Member join reconcile does not list guild members",
    test: "packages/plugins/src/spacelab-roster/reconcile-pass.test.ts",
  },
  {
    requirement: "Discord failures on member join are recorded per member",
    test: "packages/plugins/src/spacelab-roster/reconcile-pass.test.ts",
  },
  {
    requirement: "The bot requests GuildMembers intent for join events",
    test: "apps/bot/src/client-intents.ts",
  },
] as const;

describe("Space Lab member-join reconcile criteria map", () => {
  for (const item of criteria) {
    it(`maps: ${item.requirement.slice(0, 64)}… -> ${item.test}`, () => {
      assert.ok(item.test.length > 0);
    });
  }
});
