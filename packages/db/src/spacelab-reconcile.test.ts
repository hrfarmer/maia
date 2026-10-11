import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeSavedRosterUserIds } from "./spacelab-reconcile.js";

describe("spacelab reconcile persistence helpers", () => {
  it("preserves known Discord user ids when a roster is replaced on successful parse", () => {
    const merged = mergeSavedRosterUserIds(
      [
        {
          discordHandle: "user.a",
          status: "Active",
          adaptRoleValues: ["Alpha"],
          discordUserId: "uid-a",
        },
      ],
      [
        {
          discordHandle: "USER.A",
          status: "Inactive",
          adaptRoleValues: [],
        },
      ],
    );
    assert.equal(merged[0]?.discordUserId, "uid-a");
    assert.equal(merged[0]?.status, "Inactive");
  });
});
