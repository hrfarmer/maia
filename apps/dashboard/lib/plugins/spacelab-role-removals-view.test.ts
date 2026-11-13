import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSpacelabRoleRemovalsView,
  parseSpacelabRoleRemovalDecision,
} from "@/lib/plugins/spacelab-role-removals-view";

describe("spacelab role removals view", () => {
  it("names flagged roles and falls back to the id for deleted roles", () => {
    const view = buildSpacelabRoleRemovalsView(
      [
        {
          discordUserId: "uid-a",
          discordHandle: "user.a",
          roleIds: ["role-alpha", "role-gone"],
          flaggedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
      [{ id: "role-alpha", name: "Alpha" }],
    );
    assert.deepEqual(view.flags[0]?.roles, [
      { id: "role-alpha", name: "Alpha" },
      { id: "role-gone", name: "role-gone" },
    ]);
  });

  it("accepts confirm and week or forever ignores only", () => {
    assert.deepEqual(parseSpacelabRoleRemovalDecision({ action: "confirm" }), {
      action: "confirm",
    });
    assert.deepEqual(
      parseSpacelabRoleRemovalDecision({ action: "ignore", duration: "week" }),
      { action: "ignore", duration: "week" },
    );
    assert.deepEqual(
      parseSpacelabRoleRemovalDecision({ action: "ignore", duration: "forever" }),
      { action: "ignore", duration: "forever" },
    );
    assert.equal(
      parseSpacelabRoleRemovalDecision({ action: "ignore", duration: "day" }),
      null,
    );
    assert.equal(parseSpacelabRoleRemovalDecision({ action: "remove" }), null);
  });
});
