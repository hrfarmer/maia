import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_RECONCILE_MEMBER_ATTEMPTS } from "./reconcile-pass.js";
import {
  SYNTHETIC_LAB_ROSTER_EXPORT,
  SYNTHETIC_LAB_ROSTER_EXPORT_CSV,
  SYNTHETIC_LAB_ROSTER_EXPORT_CSV_SPACE_SEPARATED,
  SYNTHETIC_LAB_ROSTER_EXPORT_INVALID_ROW,
} from "./fixture.js";
import { runSpacelabGuildCycle } from "./run-spacelab-guild-cycle.js";
import { startSpacelabMinutePoll } from "./spacelab-minute-poll.js";
import { FakeGraphMailbox } from "./test-fake-graph-mailbox.js";
import type { SpacelabCycleState } from "./maia-spacelab-plugin-api.js";

function methodIsPut(init: RequestInit | undefined, input: string | URL | Request) {
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
  return method === "PUT";
}

function rosterMessage(
  id: string,
  receivedDateTime: string,
  bodyContent: string,
) {
  return { id, receivedDateTime, bodyContent };
}

function createMaiaFetch(state: {
  cycle: SpacelabCycleState;
  rosterColumn: string;
  accessToken?: "ok" | "missing" | "refresh_failed";
  rosterRows?: unknown[];
  links?: Record<string, string>;
  failures?: Array<{ memberKey: string; discordHandle: string; attempts: number }>;
  ingestCount?: { value: number };
  reconcileModes?: string[];
  memberRoleCalls?: string[];
}) {
  const accessToken = state.accessToken ?? "ok";
  state.ingestCount ??= { value: 0 };
  state.reconcileModes ??= [];
  state.memberRoleCalls ??= [];
  state.rosterRows ??= [];
  state.links ??= {};
  state.failures ??= [];

  return async (input: string | URL | Request, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? new URL(input)
        : input instanceof URL
          ? input
          : new URL(input.url);
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");

    if (url.pathname === "/v1/guilds/guild-1/microsoft/access-token") {
      if (accessToken === "missing") {
        return new Response(JSON.stringify({ error: "mailbox_not_connected" }), {
          status: 404,
        });
      }
      if (accessToken === "refresh_failed") {
        return new Response(JSON.stringify({ error: "refresh_failed" }), {
          status: 502,
        });
      }
      return new Response(JSON.stringify({ accessToken: "graph-token" }), {
        status: 200,
      });
    }

    if (url.pathname === "/v1/guilds/guild-1/values") {
      return new Response(JSON.stringify({ values: { ROSTER_COLUMN: state.rosterColumn } }), {
        status: 200,
      });
    }

    if (url.pathname === "/v1/guilds/guild-1/spacelab-roster/cycle-state") {
      if (method === "GET") {
        return new Response(
          JSON.stringify({
            lastCycleAt: state.cycle.lastCycleAt?.toISOString() ?? null,
            lastError: state.cycle.lastError,
            lastParsedMessageId: state.cycle.lastParsedMessageId,
            pendingArchiveMessageIds: state.cycle.pendingArchiveMessageIds,
            adaptLinksRevision: state.cycle.adaptLinksRevision,
            lastProcessedAdaptLinksRevision:
              state.cycle.lastProcessedAdaptLinksRevision,
          }),
          { status: 200 },
        );
      }
      const body = JSON.parse(String(init?.body ?? "{}")) as Partial<SpacelabCycleState> & {
        lastCycleAt?: string;
      };
      if (body.lastCycleAt) {
        state.cycle.lastCycleAt = new Date(body.lastCycleAt);
      }
      if (body.lastError !== undefined) {
        state.cycle.lastError = body.lastError;
      }
      if (body.lastParsedMessageId !== undefined) {
        state.cycle.lastParsedMessageId = body.lastParsedMessageId;
      }
      if (body.pendingArchiveMessageIds) {
        state.cycle.pendingArchiveMessageIds = body.pendingArchiveMessageIds;
      }
      if (body.lastProcessedAdaptLinksRevision !== undefined) {
        state.cycle.lastProcessedAdaptLinksRevision =
          body.lastProcessedAdaptLinksRevision;
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    if (
      url.pathname === "/v1/guilds/guild-1/spacelab-roster/ingest-message" &&
      method === "POST"
    ) {
      state.ingestCount.value += 1;
      const payload = JSON.parse(String(init?.body ?? "{}")) as {
        messageBody?: string;
      };
      if (payload.messageBody === SYNTHETIC_LAB_ROSTER_EXPORT_INVALID_ROW) {
        return new Response(JSON.stringify({ error: "parse_failed" }), {
          status: 422,
        });
      }
      state.failures = [];
      state.rosterRows = [
        {
          discordHandle: "user.a",
          status: "Active",
          adaptRoleValues: ["Alpha"],
        },
      ];
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    if (url.pathname === "/v1/guilds/guild-1/spacelab-roster/reconcile-state") {
      if (method === "GET") {
        if (state.rosterRows.length === 0) {
          return new Response(JSON.stringify({ error: "no_roster" }), {
            status: 404,
          });
        }
        return new Response(
          JSON.stringify({
            rows: state.rosterRows,
            links: state.links,
            rememberedMembers: [],
            failures: state.failures,
          }),
          { status: 200 },
        );
      }
      const payload = JSON.parse(String(init?.body ?? "{}")) as {
        failures?: typeof state.failures;
      };
      if (payload.failures) {
        state.failures = payload.failures;
        const modeHeader = init?.headers;
        void modeHeader;
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    if (url.pathname === "/v1/guilds/guild-1/roles") {
      return new Response(
        JSON.stringify({ roles: [{ id: "role-alpha", name: "Alpha" }] }),
        { status: 200 },
      );
    }

    if (url.pathname.startsWith("/v1/guilds/guild-1/members")) {
      if (url.pathname.endsWith("/roles") && method === "GET") {
        state.memberRoleCalls.push(`get:${url.pathname}`);
        return new Response(JSON.stringify({ roleIds: [] }), { status: 200 });
      }
      if (method === "PUT") {
        state.memberRoleCalls.push(`add:${url.pathname}`);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
    }

    if (url.pathname === "/v1/guilds/guild-1/members") {
      const query = url.searchParams.get("query");
      if (query === "user.a") {
        return new Response(
          JSON.stringify({
            members: [{ user: { id: "uid-a", username: "user.a" } }],
          }),
          { status: 200 },
        );
      }
      if (query === "user.b") {
        return new Response(
          JSON.stringify({
            members: [{ user: { id: "uid-b", username: "user.b" } }],
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ members: [] }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: "unexpected", url: url.pathname }), {
      status: 500,
    });
  };
}

describe("runSpacelabGuildCycle", () => {
  it("records mailbox_not_connected and changes neither roles nor mail", async () => {
    const graph = new FakeGraphMailbox();
    graph.inbox.push(
      rosterMessage("m1", "2026-01-02T00:00:00Z", SYNTHETIC_LAB_ROSTER_EXPORT),
    );
    const cycle: SpacelabCycleState = {
      lastCycleAt: null,
      lastError: null,
      lastParsedMessageId: null,
      pendingArchiveMessageIds: [],
      adaptLinksRevision: 0,
      lastProcessedAdaptLinksRevision: 0,
    };
    const memberRoleCalls: string[] = [];
    const result = await runSpacelabGuildCycle({
      config: {
        pluginUrl: "http://127.0.0.1:9",
        pluginToken: "token",
        guildId: "guild-1",
        fetchImpl: createMaiaFetch({
          cycle,
          rosterColumn: "Subteam",
          accessToken: "missing",
          memberRoleCalls,
        }),
      },
      graph,
    });
    assert.equal(result.skippedReason, "mailbox_not_connected");
    assert.equal(graph.inbox.length, 1);
    assert.deepEqual(graph.archived, []);
    assert.equal(memberRoleCalls.length, 0);
  });

  it("records token refresh failure without roles or archive changes", async () => {
    const graph = new FakeGraphMailbox();
    graph.inbox.push(
      rosterMessage("m1", "2026-01-02T00:00:00Z", SYNTHETIC_LAB_ROSTER_EXPORT),
    );
    const cycle: SpacelabCycleState = {
      lastCycleAt: null,
      lastError: null,
      lastParsedMessageId: null,
      pendingArchiveMessageIds: [],
      adaptLinksRevision: 0,
      lastProcessedAdaptLinksRevision: 0,
    };
    const result = await runSpacelabGuildCycle({
      config: {
        pluginUrl: "http://127.0.0.1:9",
        pluginToken: "token",
        guildId: "guild-1",
        fetchImpl: createMaiaFetch({
          cycle,
          rosterColumn: "Subteam",
          accessToken: "refresh_failed",
        }),
      },
      graph,
    });
    assert.equal(result.skippedReason, "token_refresh_failed");
    assert.equal(graph.inbox.length, 1);
    assert.deepEqual(graph.archived, []);
  });

  it("leaves non-roster mail in the inbox", async () => {
    const graph = new FakeGraphMailbox();
    graph.inbox.push(
      rosterMessage("plain", "2026-01-03T00:00:00Z", "Hello team"),
    );
    const cycle: SpacelabCycleState = {
      lastCycleAt: null,
      lastError: null,
      lastParsedMessageId: null,
      pendingArchiveMessageIds: [],
      adaptLinksRevision: 0,
      lastProcessedAdaptLinksRevision: 0,
    };
    const result = await runSpacelabGuildCycle({
      config: {
        pluginUrl: "http://127.0.0.1:9",
        pluginToken: "token",
        guildId: "guild-1",
        fetchImpl: createMaiaFetch({ cycle, rosterColumn: "Subteam" }),
      },
      graph,
    });
    assert.deepEqual(
      graph.inbox.map((message) => message.id),
      ["plain"],
    );
    assert.equal(result.skippedReason, "no_new_roster");
    assert.equal(result.notRosterReason, "missing_header DiscordHandle");
  });

  it("parses only the newest roster message in the inbox", async () => {
    const graph = new FakeGraphMailbox();
    graph.inbox.push(
      rosterMessage("older", "2026-01-01T00:00:00Z", SYNTHETIC_LAB_ROSTER_EXPORT),
      rosterMessage("newer", "2026-01-02T00:00:00Z", SYNTHETIC_LAB_ROSTER_EXPORT),
    );
    const cycle: SpacelabCycleState = {
      lastCycleAt: null,
      lastError: null,
      lastParsedMessageId: null,
      pendingArchiveMessageIds: [],
      adaptLinksRevision: 0,
      lastProcessedAdaptLinksRevision: 0,
    };
    const ingestCount = { value: 0 };
    await runSpacelabGuildCycle({
      config: {
        pluginUrl: "http://127.0.0.1:9",
        pluginToken: "token",
        guildId: "guild-1",
        fetchImpl: createMaiaFetch({
          cycle,
          rosterColumn: "Subteam",
          ingestCount,
          links: { Alpha: "role-alpha" },
        }),
      },
      graph,
    });
    assert.equal(ingestCount.value, 1);
    assert.equal(cycle.lastParsedMessageId, "newer");
    assert.deepEqual(graph.archived.sort(), ["newer", "older"]);
  });

  it("records roster_no_rows and does not ingest when the export has a header but no data rows", async () => {
    const graph = new FakeGraphMailbox();
    const headerOnly = SYNTHETIC_LAB_ROSTER_EXPORT_CSV.split("\n")[0]!;
    graph.inbox.push(
      rosterMessage("header-only", "2026-01-02T00:00:00Z", headerOnly),
    );
    const cycle: SpacelabCycleState = {
      lastCycleAt: null,
      lastError: null,
      lastParsedMessageId: null,
      pendingArchiveMessageIds: [],
      adaptLinksRevision: 0,
      lastProcessedAdaptLinksRevision: 0,
    };
    const ingestCount = { value: 0 };
    const result = await runSpacelabGuildCycle({
      config: {
        pluginUrl: "http://127.0.0.1:9",
        pluginToken: "token",
        guildId: "guild-1",
        fetchImpl: createMaiaFetch({
          cycle,
          rosterColumn: "Subteam",
          ingestCount,
        }),
      },
      graph,
    });
    assert.equal(result.skippedReason, "unparseable_roster");
    assert.equal(ingestCount.value, 0);
    assert.equal(cycle.lastError, "roster_no_rows");
    assert.deepEqual(graph.inbox.map((message) => message.id), ["header-only"]);
  });

  it("re-processes an inbox roster when lastParsedMessageId matches but saved roster rows are empty", async () => {
    const graph = new FakeGraphMailbox();
    graph.inbox.push(
      rosterMessage(
        "seen-msg",
        "2026-01-02T00:00:00Z",
        SYNTHETIC_LAB_ROSTER_EXPORT_CSV_SPACE_SEPARATED,
      ),
    );
    const cycle: SpacelabCycleState = {
      lastCycleAt: null,
      lastError: null,
      lastParsedMessageId: "seen-msg",
      pendingArchiveMessageIds: [],
      adaptLinksRevision: 0,
      lastProcessedAdaptLinksRevision: 0,
    };
    const ingestCount = { value: 0 };
    await runSpacelabGuildCycle({
      config: {
        pluginUrl: "http://127.0.0.1:9",
        pluginToken: "token",
        guildId: "guild-1",
        fetchImpl: createMaiaFetch({
          cycle,
          rosterColumn: "Subteam",
          ingestCount,
          links: { Alpha: "role-alpha" },
          rosterRows: [],
        }),
      },
      graph,
    });
    assert.equal(ingestCount.value, 1);
    assert.equal(cycle.lastParsedMessageId, "seen-msg");
  });

  it("keeps an unparseable roster in the inbox without changing saved roster", async () => {
    const graph = new FakeGraphMailbox();
    graph.inbox.push(
      rosterMessage(
        "bad",
        "2026-01-02T00:00:00Z",
        SYNTHETIC_LAB_ROSTER_EXPORT_INVALID_ROW,
      ),
    );
    const cycle: SpacelabCycleState = {
      lastCycleAt: null,
      lastError: null,
      lastParsedMessageId: null,
      pendingArchiveMessageIds: [],
      adaptLinksRevision: 0,
      lastProcessedAdaptLinksRevision: 0,
    };
    const ingestCount = { value: 0 };
    const result = await runSpacelabGuildCycle({
      config: {
        pluginUrl: "http://127.0.0.1:9",
        pluginToken: "token",
        guildId: "guild-1",
        fetchImpl: createMaiaFetch({
          cycle,
          rosterColumn: "Subteam",
          ingestCount,
        }),
      },
      graph,
    });
    assert.equal(result.skippedReason, "unparseable_roster");
    assert.equal(ingestCount.value, 0);
    assert.deepEqual(graph.inbox.map((message) => message.id), ["bad"]);
  });

  it("archives parsed roster mail even when reconcile stops after consecutive Discord errors", async () => {
    const graph = new FakeGraphMailbox();
    graph.inbox.push(
      rosterMessage("roster-1", "2026-01-02T00:00:00Z", SYNTHETIC_LAB_ROSTER_EXPORT),
    );
    const cycle: SpacelabCycleState = {
      lastCycleAt: null,
      lastError: null,
      lastParsedMessageId: null,
      pendingArchiveMessageIds: [],
      adaptLinksRevision: 0,
      lastProcessedAdaptLinksRevision: 0,
    };
    const fetchImpl = createMaiaFetch({
      cycle,
      rosterColumn: "Subteam",
      links: { Alpha: "role-alpha" },
    });
    const wrappedFetch: typeof fetch = async (input, init) => {
      const url =
        typeof input === "string"
          ? new URL(input)
          : input instanceof URL
            ? input
            : new URL(input.url);
      if (methodIsPut(init, input) && url.pathname.includes("/roles/")) {
        return new Response("discord down", { status: 503 });
      }
      return fetchImpl(input, init);
    };
    await runSpacelabGuildCycle({
      config: {
        pluginUrl: "http://127.0.0.1:9",
        pluginToken: "token",
        guildId: "guild-1",
        fetchImpl: wrappedFetch,
      },
      graph,
    });
    assert.deepEqual(graph.archived, ["roster-1"]);
    assert.equal(graph.inbox.length, 0);
  });

  it("retries archive on the next cycle without running members again", async () => {
    const graph = new FakeGraphMailbox();
    graph.inbox.push(
      rosterMessage("roster-1", "2026-01-02T00:00:00Z", SYNTHETIC_LAB_ROSTER_EXPORT),
    );
    graph.failArchiveFor.add("roster-1");
    const cycle: SpacelabCycleState = {
      lastCycleAt: null,
      lastError: null,
      lastParsedMessageId: null,
      pendingArchiveMessageIds: [],
      adaptLinksRevision: 0,
      lastProcessedAdaptLinksRevision: 0,
    };
    const memberRoleCalls: string[] = [];
    await runSpacelabGuildCycle({
      config: {
        pluginUrl: "http://127.0.0.1:9",
        pluginToken: "token",
        guildId: "guild-1",
        fetchImpl: createMaiaFetch({
          cycle,
          rosterColumn: "Subteam",
          links: { Alpha: "role-alpha" },
          memberRoleCalls,
        }),
      },
      graph,
    });
    assert.deepEqual(cycle.pendingArchiveMessageIds, ["roster-1"]);
    assert.ok(memberRoleCalls.length > 0);

    graph.failArchiveFor.clear();
    memberRoleCalls.length = 0;
    await runSpacelabGuildCycle({
      config: {
        pluginUrl: "http://127.0.0.1:9",
        pluginToken: "token",
        guildId: "guild-1",
        fetchImpl: createMaiaFetch({
          cycle,
          rosterColumn: "Subteam",
          links: { Alpha: "role-alpha" },
          memberRoleCalls,
          rosterRows: [
            {
              discordHandle: "user.a",
              status: "Active",
              adaptRoleValues: ["Alpha"],
            },
          ],
        }),
      },
      graph,
    });
    assert.equal(memberRoleCalls.length, 0);
    assert.deepEqual(graph.archived, ["roster-1"]);
  });

  it("retries only pending failures when there is no new roster message", async () => {
    const graph = new FakeGraphMailbox();
    const cycle: SpacelabCycleState = {
      lastCycleAt: null,
      lastError: null,
      lastParsedMessageId: "already-seen",
      pendingArchiveMessageIds: [],
      adaptLinksRevision: 0,
      lastProcessedAdaptLinksRevision: 0,
    };
    const memberRoleCalls: string[] = [];
    await runSpacelabGuildCycle({
      config: {
        pluginUrl: "http://127.0.0.1:9",
        pluginToken: "token",
        guildId: "guild-1",
        fetchImpl: createMaiaFetch({
          cycle,
          rosterColumn: "Subteam",
          links: { Alpha: "role-alpha" },
          rosterRows: [
            {
              discordHandle: "user.a",
              status: "Active",
              adaptRoleValues: ["Alpha"],
            },
            {
              discordHandle: "user.b",
              status: "Active",
              adaptRoleValues: ["Alpha"],
            },
          ],
          failures: [
            { memberKey: "user.a", discordHandle: "user.a", attempts: 1 },
            {
              memberKey: "user.exhausted",
              discordHandle: "user.exhausted",
              attempts: MAX_RECONCILE_MEMBER_ATTEMPTS,
            },
          ],
          memberRoleCalls,
        }),
      },
      graph,
    });
    assert.ok(memberRoleCalls.some((call) => call.includes("uid-a") || call.includes("user.a")));
    assert.ok(!memberRoleCalls.some((call) => call.includes("user.b")));
  });

  it("runs a fresh pass when adapt role links change without new mail", async () => {
    const graph = new FakeGraphMailbox();
    const cycle: SpacelabCycleState = {
      lastCycleAt: null,
      lastError: null,
      lastParsedMessageId: "seen",
      pendingArchiveMessageIds: [],
      adaptLinksRevision: 2,
      lastProcessedAdaptLinksRevision: 1,
    };
    const memberRoleCalls: string[] = [];
    await runSpacelabGuildCycle({
      config: {
        pluginUrl: "http://127.0.0.1:9",
        pluginToken: "token",
        guildId: "guild-1",
        fetchImpl: createMaiaFetch({
          cycle,
          rosterColumn: "Subteam",
          links: { Alpha: "role-alpha" },
          rosterRows: [
            {
              discordHandle: "user.a",
              status: "Active",
              adaptRoleValues: ["Alpha"],
            },
            {
              discordHandle: "user.b",
              status: "Active",
              adaptRoleValues: ["Alpha"],
            },
          ],
          failures: [],
          memberRoleCalls,
        }),
      },
      graph,
    });
    assert.ok(memberRoleCalls.length > 0);
    assert.equal(cycle.lastProcessedAdaptLinksRevision, 2);
  });

  it("clears the failure list when a new roster message is ingested", async () => {
    const graph = new FakeGraphMailbox();
    graph.inbox.push(
      rosterMessage("new-roster", "2026-01-03T00:00:00Z", SYNTHETIC_LAB_ROSTER_EXPORT),
    );
    const cycle: SpacelabCycleState = {
      lastCycleAt: null,
      lastError: null,
      lastParsedMessageId: null,
      pendingArchiveMessageIds: [],
      adaptLinksRevision: 0,
      lastProcessedAdaptLinksRevision: 0,
    };
    const mockState = {
      cycle,
      rosterColumn: "Subteam",
      links: { Alpha: "role-alpha" },
      failures: [{ memberKey: "user.a", discordHandle: "user.a", attempts: 2 }],
    };
    await runSpacelabGuildCycle({
      config: {
        pluginUrl: "http://127.0.0.1:9",
        pluginToken: "token",
        guildId: "guild-1",
        fetchImpl: createMaiaFetch(mockState),
      },
      graph,
    });
    assert.deepEqual(mockState.failures, []);
  });

  it("does not call the plugin message-send API during a full cycle with failures", async () => {
    const graph = new FakeGraphMailbox();
    graph.inbox.push(
      rosterMessage("roster-1", "2026-01-02T00:00:00Z", SYNTHETIC_LAB_ROSTER_EXPORT),
    );
    const cycle: SpacelabCycleState = {
      lastCycleAt: null,
      lastError: null,
      lastParsedMessageId: null,
      pendingArchiveMessageIds: [],
      adaptLinksRevision: 0,
      lastProcessedAdaptLinksRevision: 0,
    };
    const fetchUrls: string[] = [];
    const baseFetch = createMaiaFetch({
      cycle,
      rosterColumn: "Subteam",
      links: { Alpha: "role-alpha" },
    });
    const fetchImpl: typeof fetch = async (input, init) => {
      const url =
        typeof input === "string"
          ? new URL(input)
          : input instanceof URL
            ? input
            : new URL(input.url);
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      fetchUrls.push(`${method} ${url.pathname}`);
      if (methodIsPut(init, input) && url.pathname.includes("/roles/")) {
        return new Response("discord down", { status: 503 });
      }
      return baseFetch(input, init);
    };
    await runSpacelabGuildCycle({
      config: {
        pluginUrl: "http://127.0.0.1:9",
        pluginToken: "token",
        guildId: "guild-1",
        fetchImpl,
      },
      graph,
    });
    assert.ok(
      !fetchUrls.some(
        (entry) => entry.startsWith("POST ") && entry.includes("/messages"),
      ),
    );
  });

  it("after mailbox disconnect, a later cycle changes no Discord roles", async () => {
    const graph = new FakeGraphMailbox();
    const cycle: SpacelabCycleState = {
      lastCycleAt: new Date("2026-01-01T00:00:00Z"),
      lastError: null,
      lastParsedMessageId: "old-roster",
      pendingArchiveMessageIds: [],
      adaptLinksRevision: 0,
      lastProcessedAdaptLinksRevision: 0,
    };
    const memberRoleCalls: string[] = [];
    await runSpacelabGuildCycle({
      config: {
        pluginUrl: "http://127.0.0.1:9",
        pluginToken: "token",
        guildId: "guild-1",
        fetchImpl: createMaiaFetch({
          cycle,
          rosterColumn: "Subteam",
          accessToken: "missing",
          links: { Alpha: "role-alpha" },
          rosterRows: [
            {
              discordHandle: "user.a",
              status: "Active",
              adaptRoleValues: ["Alpha"],
            },
          ],
          memberRoleCalls,
        }),
      },
      graph,
    });
    assert.equal(memberRoleCalls.length, 0);
    assert.equal(cycle.lastError, "mailbox_not_connected");
  });

  it("skips cycles for disabled guilds without calling Discord role APIs", async () => {
    const cycles: string[] = [];
    let resolveTick: (() => void) | undefined;
    const tickPromise = new Promise<void>((resolve) => {
      resolveTick = resolve;
    });
    startSpacelabMinutePoll({
      pluginUrl: "http://127.0.0.1:9",
      pluginToken: "token",
      graph: {
        listInboxMessages: async () => [],
        moveMessageToArchive: async () => {},
      },
      fetchImpl: async (input) => {
        const url =
          typeof input === "string"
            ? new URL(input)
            : input instanceof URL
              ? input
              : new URL(input.url);
        if (url.pathname === "/v1/plugins/spacelab-roster/enabled-guilds") {
          resolveTick?.();
          return new Response(JSON.stringify({ guildIds: [] }), { status: 200 });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
      setIntervalImpl: () =>
        ({
          unref() {},
        }) as ReturnType<typeof setInterval>,
      runCycle: async ({ config }) => {
        cycles.push(config.guildId);
      },
    });
    await tickPromise;
    assert.deepEqual(cycles, []);
  });
});
