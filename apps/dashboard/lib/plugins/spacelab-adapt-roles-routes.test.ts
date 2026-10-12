import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getDevSpacelabAdaptRolesView,
  patchDevSpacelabAdaptRoleLinks,
  patchDevSpacelabGeneralMemberRoleId,
  patchDevSpacelabRosterSenderEmail,
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

  it("persists the general member role in the dev adapt roles view", () => {
    patchDevSpacelabGeneralMemberRoleId("222222222222222222");
    const view = getDevSpacelabAdaptRolesView();
    assert.equal(view.generalMemberRoleId, "222222222222222222");
  });

  it("persists roster sender email in the dev adapt roles view", () => {
    patchDevSpacelabRosterSenderEmail("roster@lab.edu");
    const view = getDevSpacelabAdaptRolesView();
    assert.equal(view.rosterSenderEmail, "roster@lab.edu");
  });
});
