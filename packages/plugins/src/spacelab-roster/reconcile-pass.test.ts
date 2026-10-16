import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  SavedRosterRow,
  SpacelabRememberedMember,
  SpacelabReconcileFailure,
} from "./types.js";
import {
  buildManagedLinkedRoleIds,
  buildManagedRoleIds,
  computeRoleChangesForMember,
  desiredLinkedRoleIdsForValues,
  exactUsernameMatches,
  runReconcilePass,
  type DiscordRoleApi,
  type ReconcilePassInput,
} from "./reconcile-pass.js";

function fakeApi(
  overrides: Partial<DiscordRoleApi> & {
    members?: Map<string, Array<{ id: string; username: string }>>;
    guildMemberList?: Array<{ id: string; username: string }>;
    roles?: Map<string, string[]>;
    calls?: Array<{ op: string; userId: string; roleId?: string }>;
    listGuildMembersCalls?: { value: number };
  } = {},
): DiscordRoleApi {
  const members = overrides.members ?? new Map();
  const roles = overrides.roles ?? new Map();
  const calls = overrides.calls ?? [];
  const listGuildMembersCalls = overrides.listGuildMembersCalls ?? { value: 0 };
  const defaultGuildList =
    overrides.guildMemberList ??
    [...members.values()].flat();
  return {
    listGuildRoleIds:
      overrides.listGuildRoleIds ??
      (async () => new Set(["role-alpha", "role-beta", "role-gamma", "role-shared"])),
    listGuildMembers:
      overrides.listGuildMembers ??
      (async () => {
        listGuildMembersCalls.value += 1;
        return [...defaultGuildList];
      }),
    getMemberRoleIds:
      overrides.getMemberRoleIds ??
      (async (userId) => roles.get(userId) ?? []),
    addRole:
      overrides.addRole ??
      (async (userId, roleId) => {
        calls.push({ op: "add", userId, roleId });
        const current = roles.get(userId) ?? [];
        roles.set(userId, [...current, roleId]);
      }),
    removeRole:
      overrides.removeRole ??
      (async (userId, roleId) => {
        calls.push({ op: "remove", userId, roleId });
        const current = roles.get(userId) ?? [];
        roles.set(
          userId,
          current.filter((id) => id !== roleId),
        );
      }),
  };
}

function links(entries: Record<string, string>) {
  return new Map(Object.entries(entries));
}

describe("reconcile pass helpers", () => {
  it("maps linked values to existing guild roles and ignores unlinked or missing roles", () => {
    const guildRoleIds = new Set(["role-alpha", "role-missing"]);
    const linkMap = links({ Alpha: "role-alpha", Beta: "role-gone", Gamma: "role-missing" });
    assert.deepEqual(
      [...desiredLinkedRoleIdsForValues(["Alpha", "Beta", "Delta"], linkMap, guildRoleIds)].sort(),
      ["role-alpha"],
    );
  });

  it("keeps a shared Discord role when any linked value matches", () => {
    const guildRoleIds = new Set(["role-shared"]);
    const linkMap = links({ Alpha: "role-shared", Beta: "role-shared" });
    assert.deepEqual(
      [...desiredLinkedRoleIdsForValues(["Alpha"], linkMap, guildRoleIds)],
      ["role-shared"],
    );
    assert.deepEqual(
      [...desiredLinkedRoleIdsForValues(["Beta"], linkMap, guildRoleIds)],
      ["role-shared"],
    );
  });

  it("matches Discord members by case-insensitive username only", () => {
    const matches = exactUsernameMatches(
      [
        { id: "1", username: "User.A" },
        { id: "2", username: "user.b" },
        { id: "3", username: "user.a.extra" },
      ],
      "user.a",
    );
    assert.deepEqual(matches, [{ id: "1", username: "User.A" }]);
  });

  it("removes any linked ADAPT role not desired in force sync mode", () => {
    const adaptLinked = buildManagedRoleIds(
      links({ Alpha: "role-alpha", Beta: "role-beta" }),
      new Set(["role-alpha", "role-beta"]),
      null,
    );
    const changes = computeRoleChangesForMember({
      currentRoleIds: ["role-beta", "role-manual"],
      desiredRoleIds: new Set(["role-alpha"]),
      removableRoleIds: new Set(),
      forceAdaptValid: true,
      adaptLinkedRoleIds: adaptLinked,
    });
    assert.deepEqual(changes, {
      toAdd: ["role-alpha"],
      toRemove: ["role-beta"],
    });
  });

  it("collects managed linked role ids that still exist in the guild", () => {
    const managed = buildManagedLinkedRoleIds(
      links({ Alpha: "role-alpha", Beta: "role-gone" }),
      new Set(["role-alpha"]),
    );
    assert.deepEqual([...managed], ["role-alpha"]);
  });
});

describe("runReconcilePass", () => {
  const baseLinks = links({
    Alpha: "role-alpha",
    Beta: "role-beta",
    Gamma: "role-gamma",
  });

  function input(
    partial: Partial<ReconcilePassInput> & {
      rows?: SavedRosterRow[];
      rememberedMembers?: SpacelabRememberedMember[];
      failures?: SpacelabReconcileFailure[];
    },
  ): ReconcilePassInput {
    return {
      rows: partial.rows ?? [],
      rememberedMembers: partial.rememberedMembers ?? [],
      links: partial.links ?? baseLinks,
      generalMemberRoleId: partial.generalMemberRoleId ?? null,
      previousAppliedLinks: partial.previousAppliedLinks ?? new Map(),
      previousAppliedGeneralMemberRoleId:
        partial.previousAppliedGeneralMemberRoleId ?? null,
      guildRoleIds:
        partial.guildRoleIds ??
        new Set([
          "role-alpha",
          "role-beta",
          "role-gamma",
          "role-shared",
          "role-general",
        ]),
      failures: partial.failures ?? [],
      mode: partial.mode ?? { kind: "full" },
    };
  }

  it("adds mapped roles for an active row with exactly one username match", async () => {
    const calls: Array<{ op: string; userId: string; roleId?: string }> = [];
    const api = fakeApi({
      calls,
      members: new Map([["user.a", [{ id: "uid-a", username: "user.a" }]]]),
      roles: new Map([["uid-a", []]]),
    });
    const result = await runReconcilePass(
      input({
        rows: [
          {
            discordHandle: "user.a",
            status: "Active",
            adaptRoleValues: ["Alpha"],
          },
        ],
      }),
      api,
    );
    assert.deepEqual(calls, [{ op: "add", userId: "uid-a", roleId: "role-alpha" }]);
    assert.equal(result.rows[0]?.discordUserId, "uid-a");
    assert.equal(result.rememberedMembers.length, 1);
    assert.equal(result.failures.length, 0);
  });

  it("skips rows with zero or multiple username matches and continues the pass", async () => {
    const calls: Array<{ op: string; userId: string; roleId?: string }> = [];
    const api = fakeApi({
      calls,
      members: new Map([
        ["none", []],
        ["dupe", [
          { id: "1", username: "dupe" },
          { id: "2", username: "Dupe" },
        ]],
        ["user.b", [{ id: "uid-b", username: "user.b" }]],
      ]),
      roles: new Map([["uid-b", []]]),
    });
    const result = await runReconcilePass(
      input({
        rows: [
          { discordHandle: "none", status: "Active", adaptRoleValues: ["Alpha"] },
          { discordHandle: "dupe", status: "Active", adaptRoleValues: ["Alpha"] },
          { discordHandle: "user.b", status: "Active", adaptRoleValues: ["Gamma"] },
        ],
      }),
      api,
    );
    assert.deepEqual(calls, [{ op: "add", userId: "uid-b", roleId: "role-gamma" }]);
    assert.equal(result.rememberedMembers.length, 1);
  });

  it("removes mapped roles for inactive, absent, or de-linked remembered members", async () => {
    const calls: Array<{ op: string; userId: string; roleId?: string }> = [];
    const api = fakeApi({
      calls,
      members: new Map([
        ["inactive.user", [{ id: "uid-inactive", username: "inactive.user" }]],
        ["empty.user", [{ id: "uid-empty", username: "empty.user" }]],
      ]),
      roles: new Map([
        ["uid-inactive", ["role-alpha"]],
        ["uid-empty", ["role-beta"]],
        ["uid-gone", ["role-gamma"]],
      ]),
    });
    await runReconcilePass(
      input({
        rows: [
          {
            discordHandle: "inactive.user",
            status: "Inactive",
            adaptRoleValues: ["Alpha"],
            discordUserId: "uid-inactive",
          },
          {
            discordHandle: "empty.user",
            status: "Active",
            adaptRoleValues: [],
            discordUserId: "uid-empty",
          },
          {
            discordHandle: "still.active",
            status: "Active",
            adaptRoleValues: ["Alpha"],
          },
        ],
        rememberedMembers: [
          {
            discordUserId: "uid-inactive",
            discordHandle: "inactive.user",
            grantedRoleIds: ["role-alpha"],
          },
          {
            discordUserId: "uid-empty",
            discordHandle: "empty.user",
            grantedRoleIds: ["role-beta"],
          },
          {
            discordUserId: "uid-gone",
            discordHandle: "gone.user",
            grantedRoleIds: ["role-gamma"],
          },
        ],
      }),
      api,
    );
    assert.deepEqual(
      [...calls].sort((a, b) => a.userId.localeCompare(b.userId)),
      [
        { op: "remove", userId: "uid-empty", roleId: "role-beta" },
        { op: "remove", userId: "uid-gone", roleId: "role-gamma" },
        { op: "remove", userId: "uid-inactive", roleId: "role-alpha" },
      ],
    );
  });

  it("removes mapped roles when an active row no longer includes a linked value", async () => {
    const calls: Array<{ op: string; userId: string; roleId?: string }> = [];
    const api = fakeApi({
      calls,
      roles: new Map([["uid-a", ["role-alpha", "role-beta"]]]),
    });
    await runReconcilePass(
      input({
        rows: [
          {
            discordHandle: "user.a",
            status: "Active",
            adaptRoleValues: ["Alpha"],
            discordUserId: "uid-a",
          },
        ],
        rememberedMembers: [
          {
            discordUserId: "uid-a",
            discordHandle: "user.a",
            grantedRoleIds: ["role-alpha", "role-beta"],
          },
        ],
      }),
      api,
    );
    assert.deepEqual(calls, [{ op: "remove", userId: "uid-a", roleId: "role-beta" }]);
  });

  it("remembers a member even when their mapped roles already match", async () => {
    const calls: Array<{ op: string; userId: string; roleId?: string }> = [];
    const api = fakeApi({
      calls,
      members: new Map([["user.a", [{ id: "uid-a", username: "user.a" }]]]),
      roles: new Map([["uid-a", ["role-alpha"]]]),
    });
    const result = await runReconcilePass(
      input({
        rows: [
          { discordHandle: "user.a", status: "Active", adaptRoleValues: ["Alpha"] },
        ],
      }),
      api,
    );
    assert.equal(calls.length, 0);
    assert.equal(result.rememberedMembers[0]?.discordUserId, "uid-a");
  });

  it("uses stored Discord user ids for later removals without listing members", async () => {
    const listGuildMembersCalls = { value: 0 };
    const api = fakeApi({
      listGuildMembersCalls,
      listGuildMembers: async () => {
        listGuildMembersCalls.value += 1;
        return [];
      },
      roles: new Map([["uid-a", ["role-alpha"]]]),
      calls: [],
    });
    await runReconcilePass(
      input({
        rows: [],
        rememberedMembers: [{ discordUserId: "uid-a", discordHandle: "user.a" }],
      }),
      api,
    );
    assert.equal(listGuildMembersCalls.value, 0);
  });

  it("lists guild members once for many roster rows instead of searching per handle", async () => {
    const listGuildMembersCalls = { value: 0 };
    const guildMemberList = Array.from({ length: 33 }, (_, index) => ({
      id: `uid-${index}`,
      username: `user-${index}`,
    }));
    const rows = guildMemberList.map((member, index) => ({
      discordHandle: `User-${index}`,
      status: "Active" as const,
      adaptRoleValues: ["Alpha"],
    }));
    const api = fakeApi({
      listGuildMembersCalls,
      guildMemberList,
      roles: new Map(guildMemberList.map((member) => [member.id, []])),
    });
    await runReconcilePass(input({ rows }), api);
    assert.equal(listGuildMembersCalls.value, 1);
  });

  it("matches roster handles case-insensitively and legacy name#discrim forms", async () => {
    const api = fakeApi({
      guildMemberList: [
        { id: "uid-legacy", username: "LegacyUser" },
        { id: "uid-case", username: "Mixed.Case" },
      ],
      roles: new Map([
        ["uid-legacy", []],
        ["uid-case", []],
      ]),
    });
    const result = await runReconcilePass(
      input({
        rows: [
          {
            discordHandle: "legacyuser#1234",
            status: "Active",
            adaptRoleValues: ["Alpha"],
          },
          {
            discordHandle: "mixed.case",
            status: "Active",
            adaptRoleValues: ["Alpha"],
          },
        ],
      }),
      api,
    );
    assert.equal(result.rows[0]?.discordUserId, "uid-legacy");
    assert.equal(result.rows[1]?.discordUserId, "uid-case");
  });

  it("continues the pass when one member's role API fails", async () => {
    const calls: Array<{ op: string; userId: string; roleId?: string }> = [];
    const api = fakeApi({
      calls,
      guildMemberList: [
        { id: "uid-fail", username: "fail.user" },
        { id: "uid-ok", username: "ok.user" },
      ],
      roles: new Map([
        ["uid-fail", []],
        ["uid-ok", []],
      ]),
      getMemberRoleIds: async (userId) => {
        if (userId === "uid-fail") {
          throw new Error("discord member roles unavailable");
        }
        return [];
      },
    });
    const result = await runReconcilePass(
      input({
        rows: [
          { discordHandle: "fail.user", status: "Active", adaptRoleValues: ["Alpha"] },
          { discordHandle: "ok.user", status: "Active", adaptRoleValues: ["Alpha"] },
        ],
      }),
      api,
    );
    assert.deepEqual(calls, [{ op: "add", userId: "uid-ok", roleId: "role-alpha" }]);
    assert.equal(result.failures.length, 1);
    assert.equal(result.rememberedMembers.length, 1);
  });

  it("records failures by handle until a user id is known and keeps remembered members on later failures", async () => {
    const api = fakeApi({
      members: new Map([["user.a", [{ id: "uid-a", username: "user.a" }]]]),
      addRole: async () => {
        throw new Error("discord down");
      },
      roles: new Map([["uid-a", []]]),
    });
    const first = await runReconcilePass(
      input({
        rows: [
          { discordHandle: "user.a", status: "Active", adaptRoleValues: ["Alpha"] },
        ],
      }),
      api,
    );
    assert.equal(first.failures[0]?.memberKey, "user.a");
    assert.equal(first.failures[0]?.attempts, 1);
    assert.equal(first.rememberedMembers.length, 0);

    const second = await runReconcilePass(
      input({
        rows: [
          {
            discordHandle: "user.a",
            status: "Active",
            adaptRoleValues: ["Alpha"],
            discordUserId: "uid-a",
          },
        ],
        rememberedMembers: [{ discordUserId: "uid-a", discordHandle: "user.a" }],
        failures: first.failures,
      }),
      api,
    );
    assert.equal(second.failures[0]?.memberKey, "uid-a");
    assert.equal(second.rememberedMembers.length, 1);
  });

  it("stops after three consecutive Discord errors and leaves remaining members pending", async () => {
    const calls: Array<{ op: string; userId: string; roleId?: string }> = [];
    let attempts = 0;
    const api = fakeApi({
      calls,
      members: new Map([
        ["fail1", [{ id: "f1", username: "fail1" }]],
        ["fail2", [{ id: "f2", username: "fail2" }]],
        ["fail3", [{ id: "f3", username: "fail3" }]],
        ["ok", [{ id: "ok1", username: "ok" }]],
      ]),
      roles: new Map([
        ["f1", []],
        ["f2", []],
        ["f3", []],
        ["ok1", []],
      ]),
      addRole: async (userId) => {
        attempts += 1;
        if (userId.startsWith("f")) {
          throw new Error("discord");
        }
      },
    });
    const result = await runReconcilePass(
      input({
        rows: [
          { discordHandle: "fail1", status: "Active", adaptRoleValues: ["Alpha"] },
          { discordHandle: "fail2", status: "Active", adaptRoleValues: ["Alpha"] },
          { discordHandle: "fail3", status: "Active", adaptRoleValues: ["Alpha"] },
          { discordHandle: "ok", status: "Active", adaptRoleValues: ["Alpha"] },
        ],
      }),
      api,
    );
    assert.equal(result.stoppedEarly, true);
    assert.equal(result.failures.length, 3);
    assert.equal(calls.length, 0);
    assert.equal(result.rememberedMembers.length, 0);
  });

  it("exhausts a member after five failed attempts", async () => {
    const api = fakeApi({
      members: new Map([["user.a", [{ id: "uid-a", username: "user.a" }]]]),
      addRole: async () => {
        throw new Error("nope");
      },
      roles: new Map([["uid-a", []]]),
    });
    let failures: SpacelabReconcileFailure[] = [];
    for (let i = 0; i < 5; i += 1) {
      const result = await runReconcilePass(
        input({
          rows: [
            { discordHandle: "user.a", status: "Active", adaptRoleValues: ["Alpha"] },
          ],
          failures,
          mode: { kind: i === 0 ? "full" : "retry-failures-only" },
        }),
        api,
      );
      failures = result.failures;
    }
    assert.equal(failures[0]?.attempts, 5);
    const sixth = await runReconcilePass(
      input({
        rows: [
          { discordHandle: "user.a", status: "Active", adaptRoleValues: ["Alpha"] },
        ],
        failures,
        mode: { kind: "retry-failures-only" },
      }),
      api,
    );
    assert.equal(sixth.failures[0]?.attempts, 5);
  });

  it("grants the general member role when a row qualifies for ADAPT", async () => {
    const calls: Array<{ op: string; userId: string; roleId?: string }> = [];
    const api = fakeApi({
      calls,
      guildMemberList: [{ id: "uid-a", username: "user.a" }],
      roles: new Map([["uid-a", []]]),
    });
    await runReconcilePass(
      input({
        generalMemberRoleId: "role-general",
        rows: [
          { discordHandle: "user.a", status: "Active", adaptRoleValues: ["Alpha"] },
        ],
      }),
      api,
    );
    assert.deepEqual(
      [...calls].sort((a, b) => a.roleId!.localeCompare(b.roleId!)),
      [
        { op: "add", userId: "uid-a", roleId: "role-alpha" },
        { op: "add", userId: "uid-a", roleId: "role-general" },
      ],
    );
  });

  it("does not grant the general member role when inactive or values are unmapped", async () => {
    const calls: Array<{ op: string; userId: string; roleId?: string }> = [];
    const api = fakeApi({
      calls,
      guildMemberList: [
        { id: "uid-inactive", username: "inactive.user" },
        { id: "uid-unmapped", username: "unmapped.user" },
      ],
      roles: new Map([
        ["uid-inactive", []],
        ["uid-unmapped", []],
      ]),
    });
    await runReconcilePass(
      input({
        generalMemberRoleId: "role-general",
        rows: [
          {
            discordHandle: "inactive.user",
            status: "Inactive",
            adaptRoleValues: ["Alpha"],
          },
          {
            discordHandle: "unmapped.user",
            status: "Active",
            adaptRoleValues: ["Delta"],
          },
        ],
      }),
      api,
    );
    assert.equal(calls.length, 0);
  });

  it("removes the general member role when a remembered member no longer qualifies", async () => {
    const calls: Array<{ op: string; userId: string; roleId?: string }> = [];
    const api = fakeApi({
      calls,
      roles: new Map([["uid-a", ["role-general", "role-alpha"]]]),
    });
    await runReconcilePass(
      input({
        generalMemberRoleId: "role-general",
        rows: [
          {
            discordHandle: "user.a",
            status: "Inactive",
            adaptRoleValues: ["Alpha"],
            discordUserId: "uid-a",
          },
        ],
        rememberedMembers: [
          {
            discordUserId: "uid-a",
            discordHandle: "user.a",
            grantedRoleIds: ["role-general", "role-alpha"],
          },
        ],
      }),
      api,
    );
    assert.deepEqual(
      [...calls].sort((a, b) => a.roleId!.localeCompare(b.roleId!)),
      [
        { op: "remove", userId: "uid-a", roleId: "role-alpha" },
        { op: "remove", userId: "uid-a", roleId: "role-general" },
      ],
    );
  });

  it("uses previous applied links to remove stale roles for legacy remembered members", async () => {
    const calls: Array<{ op: string; userId: string; roleId?: string }> = [];
    const api = fakeApi({
      calls,
      roles: new Map([["uid-a", ["role-alpha", "role-manual"]]]),
    });
    await runReconcilePass(
      input({
        links: links({ Alpha: "role-beta" }),
        previousAppliedLinks: links({ Alpha: "role-alpha" }),
        rows: [
          {
            discordHandle: "user.a",
            status: "Active",
            adaptRoleValues: ["Alpha"],
            discordUserId: "uid-a",
          },
        ],
        rememberedMembers: [{ discordUserId: "uid-a", discordHandle: "user.a" }],
      }),
      api,
    );
    assert.deepEqual(calls, [
      { op: "add", userId: "uid-a", roleId: "role-beta" },
      { op: "remove", userId: "uid-a", roleId: "role-alpha" },
    ]);
  });

  it("force sync strips an extra linked role and adds missing roles", async () => {
    const calls: Array<{ op: string; userId: string; roleId?: string }> = [];
    const api = fakeApi({
      calls,
      roles: new Map([["uid-a", ["role-beta", "role-manual"]]]),
    });
    await runReconcilePass(
      input({
        mode: { kind: "force-sync" },
        links: links({ Alpha: "role-alpha", Beta: "role-beta" }),
        rows: [
          {
            discordHandle: "user.a",
            status: "Active",
            adaptRoleValues: ["Alpha"],
            discordUserId: "uid-a",
          },
        ],
        rememberedMembers: [{ discordUserId: "uid-a", discordHandle: "user.a" }],
      }),
      api,
    );
    assert.deepEqual(calls, [
      { op: "add", userId: "uid-a", roleId: "role-alpha" },
      { op: "remove", userId: "uid-a", roleId: "role-beta" },
    ]);
  });

  it("removes a previously granted role after relink and keeps manual roles", async () => {
    const calls: Array<{ op: string; userId: string; roleId?: string }> = [];
    const roles = new Map<string, string[]>([["uid-a", ["role-manual"]]]);
    const api = fakeApi({
      calls,
      guildMemberList: [{ id: "uid-a", username: "user.a" }],
      roles,
    });
    const linksAlphaA = links({ Alpha: "role-alpha" });
    const first = await runReconcilePass(
      input({
        links: linksAlphaA,
        rows: [
          { discordHandle: "user.a", status: "Active", adaptRoleValues: ["Alpha"] },
        ],
      }),
      api,
    );
    assert.deepEqual(calls, [
      { op: "add", userId: "uid-a", roleId: "role-alpha" },
    ]);

    calls.length = 0;
    await runReconcilePass(
      input({
        links: links({ Alpha: "role-beta" }),
        previousAppliedLinks: linksAlphaA,
        rememberedMembers: first.rememberedMembers,
        rows: [
          {
            discordHandle: "user.a",
            status: "Active",
            adaptRoleValues: ["Alpha"],
            discordUserId: "uid-a",
          },
        ],
      }),
      api,
    );
    assert.deepEqual(calls, [
      { op: "add", userId: "uid-a", roleId: "role-beta" },
      { op: "remove", userId: "uid-a", roleId: "role-alpha" },
    ]);
    assert.deepEqual(first.rememberedMembers[0]?.grantedRoleIds, ["role-alpha"]);
  });

  it("does not grant or remove a general member role when unset", async () => {
    const calls: Array<{ op: string; userId: string; roleId?: string }> = [];
    const api = fakeApi({
      calls,
      guildMemberList: [{ id: "uid-a", username: "user.a" }],
      roles: new Map([["uid-a", ["role-general"]]]),
    });
    await runReconcilePass(
      input({
        generalMemberRoleId: null,
        rows: [
          { discordHandle: "user.a", status: "Active", adaptRoleValues: ["Alpha"] },
        ],
      }),
      api,
    );
    assert.deepEqual(calls, [
      { op: "add", userId: "uid-a", roleId: "role-alpha" },
    ]);
  });

  it("never calls a replace-all-roles API", async () => {
    const api = fakeApi({
      members: new Map([["user.a", [{ id: "uid-a", username: "user.a" }]]]),
      roles: new Map([["uid-a", []]]),
    });
    assert.equal("setMemberRoles" in api, false);
    await runReconcilePass(
      input({
        rows: [
          { discordHandle: "user.a", status: "Active", adaptRoleValues: ["Alpha"] },
        ],
      }),
      api,
    );
  });

  it("member-join mode grants linked roles and general role without listing guild members", async () => {
    const calls: Array<{ op: string; userId: string; roleId?: string }> = [];
    const listGuildMembersCalls = { value: 0 };
    const api = fakeApi({
      calls,
      listGuildMembersCalls,
      roles: new Map([["uid-a", []]]),
    });
    const result = await runReconcilePass(
      input({
        generalMemberRoleId: "role-general",
        rows: [
          {
            discordHandle: "User.A",
            status: "Active",
            adaptRoleValues: ["Alpha"],
          },
        ],
        mode: {
          kind: "member-join",
          discordUserId: "uid-a",
          username: "user.a",
        },
      }),
      api,
    );
    assert.equal(listGuildMembersCalls.value, 0);
    assert.deepEqual(
      [...calls].sort((a, b) => a.roleId!.localeCompare(b.roleId!)),
      [
        { op: "add", userId: "uid-a", roleId: "role-alpha" },
        { op: "add", userId: "uid-a", roleId: "role-general" },
      ],
    );
    assert.deepEqual(result.rememberedMembers[0]?.grantedRoleIds?.sort(), [
      "role-alpha",
      "role-general",
    ]);
  });

  it("member-join mode does nothing for non-roster, inactive, or unmapped joiners", async () => {
    const calls: Array<{ op: string; userId: string; roleId?: string }> = [];
    const api = fakeApi({ calls, roles: new Map() });
    const baseMode = {
      kind: "member-join" as const,
      discordUserId: "uid-x",
      username: "stranger",
    };
    await runReconcilePass(
      input({
        rows: [
          {
            discordHandle: "inactive.user",
            status: "Inactive",
            adaptRoleValues: ["Alpha"],
          },
          {
            discordHandle: "unmapped.user",
            status: "Active",
            adaptRoleValues: ["Delta"],
          },
        ],
        mode: baseMode,
      }),
      api,
    );
    await runReconcilePass(
      input({
        rows: [
          {
            discordHandle: "inactive.user",
            status: "Inactive",
            adaptRoleValues: ["Alpha"],
          },
        ],
        mode: {
          kind: "member-join",
          discordUserId: "uid-inactive",
          username: "inactive.user",
        },
      }),
      api,
    );
    await runReconcilePass(
      input({
        rows: [
          {
            discordHandle: "unmapped.user",
            status: "Active",
            adaptRoleValues: ["Delta"],
          },
        ],
        mode: {
          kind: "member-join",
          discordUserId: "uid-unmapped",
          username: "unmapped.user",
        },
      }),
      api,
    );
    assert.equal(calls.length, 0);
  });

  it("member-join mode records failures without throwing", async () => {
    const api = fakeApi({
      roles: new Map([["uid-a", []]]),
      addRole: async () => {
        throw new Error("discord down");
      },
    });
    const result = await runReconcilePass(
      input({
        rows: [
          {
            discordHandle: "user.a",
            status: "Active",
            adaptRoleValues: ["Alpha"],
          },
        ],
        mode: {
          kind: "member-join",
          discordUserId: "uid-a",
          username: "user.a",
        },
      }),
      api,
    );
    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0]?.attempts, 1);
  });
});
