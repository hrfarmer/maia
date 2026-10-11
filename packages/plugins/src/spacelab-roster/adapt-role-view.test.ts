import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSpacelabAdaptRoleRows } from "./adapt-role-view.js";

describe("buildSpacelabAdaptRoleRows", () => {
  it("lists current roster values and keeps saved links for values no longer in the roster", () => {
    const rows = buildSpacelabAdaptRoleRows({
      currentAdaptValues: ["Alpha", "Beta"],
      linkedRoles: new Map([
        ["Alpha", "role-1"],
        ["Retired", "role-2"],
      ]),
      guildRoleIds: new Set(["role-1", "role-2"]),
    });
    assert.deepEqual(
      rows.map((row) => row.adaptValue),
      ["Alpha", "Beta", "Retired"],
    );
    const retired = rows.find((row) => row.adaptValue === "Retired");
    assert.ok(retired);
    assert.equal(retired.inCurrentRoster, false);
    assert.equal(retired.linkedRoleId, "role-2");
  });

  it("marks a stored Discord role that is no longer in the guild as missing", () => {
    const rows = buildSpacelabAdaptRoleRows({
      currentAdaptValues: ["Alpha"],
      linkedRoles: new Map([["Alpha", "deleted-role"]]),
      guildRoleIds: new Set(["role-1"]),
    });
    assert.equal(rows[0]?.linkedRoleMissing, true);
  });

  it("shows unlinked values without a stored role", () => {
    const rows = buildSpacelabAdaptRoleRows({
      currentAdaptValues: ["Alpha"],
      linkedRoles: new Map(),
      guildRoleIds: new Set(["role-1"]),
    });
    assert.equal(rows[0]?.linkedRoleId, null);
    assert.equal(rows[0]?.linkedRoleMissing, false);
  });
});
