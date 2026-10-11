import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getDevSpacelabAdaptRolesView,
  patchDevSpacelabAdaptRoleLinks,
} from "@/lib/dev-spacelab-adapt-roles";

describe("spacelab adapt roles dev routes seam", () => {
  it("reloads saved links for the Plugins card view", () => {
    patchDevSpacelabAdaptRoleLinks({ Alpha: "111111111111111111" });
    const first = getDevSpacelabAdaptRolesView();
    const alphaFirst = first.adaptRoleRows.find((row) => row.adaptValue === "Alpha");
    assert.equal(alphaFirst?.linkedRoleId, "111111111111111111");

    const second = getDevSpacelabAdaptRolesView();
    const alphaSecond = second.adaptRoleRows.find(
      (row) => row.adaptValue === "Alpha",
    );
    assert.equal(alphaSecond?.linkedRoleId, "111111111111111111");
  });
});
