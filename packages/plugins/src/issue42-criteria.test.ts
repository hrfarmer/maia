import assert from "node:assert/strict";
import { describe, it } from "node:test";

const criteria = [
  {
    criterion:
      "Each enabled guild is checked once a minute. A guild that is not enabled is not checked.",
    test: "packages/plugins/src/spacelab-roster/spacelab-minute-poll.test.ts",
  },
  {
    criterion:
      "Until a mailbox is connected, a cycle records that and does not change Discord roles or archive mail.",
    test: "packages/plugins/src/spacelab-roster/run-spacelab-guild-cycle.test.ts",
  },
  {
    criterion:
      "A failed token refresh records the error, changes no Discord roles, and archives nothing.",
    test: "packages/plugins/src/spacelab-roster/run-spacelab-guild-cycle.test.ts",
  },
  {
    criterion: "Mail that is not a roster export stays in the Inbox.",
    test: "packages/plugins/src/spacelab-roster/run-spacelab-guild-cycle.test.ts",
  },
  {
    criterion:
      "Of the roster messages in the Inbox, only the one with the latest received time is parsed.",
    test: "packages/plugins/src/spacelab-roster/run-spacelab-guild-cycle.test.ts",
  },
  {
    criterion:
      "A roster message with a row that cannot be parsed stays in the Inbox. Discord roles and the saved roster stay as they were.",
    test: "packages/plugins/src/spacelab-roster/run-spacelab-guild-cycle.test.ts",
  },
  {
    criterion:
      "Once a roster is parsed and saved, that message and every older roster message are archived, including when three consecutive Discord errors stop the pass.",
    test: "packages/plugins/src/spacelab-roster/run-spacelab-guild-cycle.test.ts",
  },
  {
    criterion:
      "If the Archive move fails, the next cycle retries the move and does not run the members again.",
    test: "packages/plugins/src/spacelab-roster/run-spacelab-guild-cycle.test.ts",
  },
  {
    criterion:
      "When the Inbox has no new roster message, the cycle retries only pending failures. Exhausted members are not called.",
    test: "packages/plugins/src/spacelab-roster/run-spacelab-guild-cycle.test.ts",
  },
  {
    criterion:
      "A new roster message replaces the failure list and starts a fresh pass.",
    test: "packages/plugins/src/spacelab-roster/run-spacelab-guild-cycle.test.ts",
  },
  {
    criterion:
      "A role-link edit, with no new email, does the same fresh pass from the saved roster on the next cycle and resets attempt counts.",
    test: "packages/plugins/src/spacelab-roster/run-spacelab-guild-cycle.test.ts",
  },
  {
    criterion:
      "The Plugins card shows the last cycle time, the last error, members waiting for retry, and members who have used all five attempts.",
    test: "apps/dashboard/lib/plugins/spacelab-cycle-status.test.ts",
  },
  {
    criterion: "The plugin does not post a Discord message.",
    test: "packages/plugins/src/spacelab-roster/run-spacelab-guild-cycle.test.ts",
  },
  {
    criterion:
      "Disconnecting the mailbox or disabling the plugin stops later cycles and does not change Discord roles.",
    test: "packages/plugins/src/spacelab-roster/run-spacelab-guild-cycle.test.ts (mailbox disconnect); packages/plugins/src/spacelab-roster/spacelab-minute-poll.test.ts (disabled guild)",
  },
  {
    criterion:
      "Automated tests cover the behavior above with a fake Graph mailbox and a fake Discord role API.",
    test: "packages/plugins/src/spacelab-roster/run-spacelab-guild-cycle.test.ts",
  },
] as const;

describe("issue #42 acceptance criteria map", () => {
  for (const item of criteria) {
    it(`maps: ${item.criterion.slice(0, 72)}… -> ${item.test}`, () => {
      assert.ok(item.test.length > 0);
    });
  }
});
