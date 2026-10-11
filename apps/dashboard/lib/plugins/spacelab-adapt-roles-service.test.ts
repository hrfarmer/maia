import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SYNTHETIC_LAB_ROSTER_EXPORT,
  SYNTHETIC_LAB_ROSTER_EXPORT_INVALID_ROW,
} from "@maia/plugins";
import type { ParsedRosterRow } from "@maia/plugins";
import {
  buildSpacelabAdaptRolesView,
  ingestSpacelabRosterMessage,
  saveSpacelabAdaptRoleLinks,
  type SpacelabRosterRepository,
} from "./spacelab-adapt-roles-service.js";

function createMemoryRepository(): SpacelabRosterRepository {
  const state = {
    parsed: null as {
      rows: ParsedRosterRow[];
      adaptValues: string[];
      parsedAt: Date;
    } | null,
    links: new Map<string, string>(),
  };
  return {
    async getParsedRoster() {
      return state.parsed;
    },
    async saveParsedRoster(input) {
      state.parsed = {
        ...input,
        parsedAt: new Date("2026-10-11T12:00:00.000Z"),
      };
    },
    async getLinkedRoles() {
      return new Map(state.links);
    },
    async setLinkedRole(adaptValue, discordRoleId) {
      if (discordRoleId === null) {
        state.links.delete(adaptValue);
        return;
      }
      state.links.set(adaptValue, discordRoleId);
    },
  };
}

describe("spacelab adapt roles service", () => {
  it("lists distinct ADAPT Role values after a successful parse for the Plugins card", async () => {
    const repo = createMemoryRepository();
    const ingest = await ingestSpacelabRosterMessage(
      repo,
      SYNTHETIC_LAB_ROSTER_EXPORT,
      "Subteam",
    );
    assert.equal(ingest.ok, true);
    const view = await buildSpacelabAdaptRolesView(repo, [
      { id: "role-1", name: "Lead" },
    ]);
    assert.deepEqual(
      view.adaptRoleRows.map((row) => row.adaptValue),
      ["Alpha", "Beta", "Delta", "Gamma"],
    );
  });

  it("keeps prior roster and links when a later message fails to parse", async () => {
    const repo = createMemoryRepository();
    await ingestSpacelabRosterMessage(repo, SYNTHETIC_LAB_ROSTER_EXPORT, "Subteam");
    await saveSpacelabAdaptRoleLinks(repo, { Alpha: "role-1" });
    const before = await buildSpacelabAdaptRolesView(repo, [
      { id: "role-1", name: "Lead" },
    ]);
    const failed = await ingestSpacelabRosterMessage(
      repo,
      SYNTHETIC_LAB_ROSTER_EXPORT_INVALID_ROW,
      "Subteam",
    );
    assert.equal(failed.ok, false);
    const after = await buildSpacelabAdaptRolesView(repo, [
      { id: "role-1", name: "Lead" },
    ]);
    assert.deepEqual(after.adaptRoleRows, before.adaptRoleRows);
    assert.equal(after.adaptRoleRows[0]?.linkedRoleId, "role-1");
  });

  it("stores one Discord role per value and allows two values to share a role", async () => {
    const repo = createMemoryRepository();
    await ingestSpacelabRosterMessage(repo, SYNTHETIC_LAB_ROSTER_EXPORT, "Subteam");
    await saveSpacelabAdaptRoleLinks(repo, {
      Alpha: "role-1",
      Beta: "role-1",
    });
    const view = await buildSpacelabAdaptRolesView(repo, [
      { id: "role-1", name: "Shared" },
      { id: "role-2", name: "Other" },
    ]);
    const alpha = view.adaptRoleRows.find((row) => row.adaptValue === "Alpha");
    const beta = view.adaptRoleRows.find((row) => row.adaptValue === "Beta");
    assert.equal(alpha?.linkedRoleId, "role-1");
    assert.equal(beta?.linkedRoleId, "role-1");
  });

  it("keeps a saved link when the value is missing from a later successful parse", async () => {
    const repo = createMemoryRepository();
    await ingestSpacelabRosterMessage(repo, SYNTHETIC_LAB_ROSTER_EXPORT, "Subteam");
    await saveSpacelabAdaptRoleLinks(repo, { Alpha: "role-1" });
    const smallerExport = [
      "DiscordHandle\tStatus\tSubteam\tSubteam#Id",
      'user.b\tActive\t{"Value":"Gamma"}\t3',
    ].join("\n");
    await ingestSpacelabRosterMessage(repo, smallerExport, "Subteam");
    const view = await buildSpacelabAdaptRolesView(repo, [
      { id: "role-1", name: "Lead" },
    ]);
    const alpha = view.adaptRoleRows.find((row) => row.adaptValue === "Alpha");
    assert.ok(alpha);
    assert.equal(alpha.inCurrentRoster, false);
    assert.equal(alpha.linkedRoleId, "role-1");
  });
});
