import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SPACELAB_POLL_INTERVAL_MS,
  startSpacelabMinutePoll,
} from "./spacelab-minute-poll.js";

describe("Space Lab minute poll", () => {
  it("checks each enabled guild on the poll interval", async () => {
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
          return new Response(JSON.stringify({ guildIds: ["guild-a", "guild-b"] }), {
            status: 200,
          });
        }
        if (url.pathname.endsWith("/cycle-state")) {
          return new Response(
            JSON.stringify({
              lastCycleAt: null,
              lastError: null,
              lastParsedMessageId: null,
              pendingArchiveMessageIds: [],
              adaptLinksRevision: 0,
              lastProcessedAdaptLinksRevision: 0,
            }),
            { status: 200 },
          );
        }
        if (url.pathname.endsWith("/microsoft/access-token")) {
          return new Response(JSON.stringify({ error: "missing" }), { status: 404 });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
      setIntervalImpl: () =>
        ({
          unref() {},
        }) as ReturnType<typeof setInterval>,
      runCycle: async ({ config }) => {
        cycles.push(config.guildId);
        if (cycles.length >= 2) {
          resolveTick?.();
        }
      },
    });

    await tickPromise;
    assert.deepEqual(cycles.sort(), ["guild-a", "guild-b"]);
    assert.equal(SPACELAB_POLL_INTERVAL_MS, 60_000);
  });

  it("does not run a cycle for a guild that is not enabled", async () => {
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
          return new Response(JSON.stringify({ guildIds: ["guild-enabled"] }), {
            status: 200,
          });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
      setIntervalImpl: () =>
        ({
          unref() {},
        }) as ReturnType<typeof setInterval>,
      runCycle: async ({ config }) => {
        cycles.push(config.guildId);
        resolveTick?.();
      },
    });

    await tickPromise;
    assert.deepEqual(cycles, ["guild-enabled"]);
    assert.ok(!cycles.includes("guild-disabled"));
  });

  it("logs and continues when enabled-guilds or a guild cycle throws", async () => {
    const errors: string[] = [];
    const originalError = console.error;
    console.error = (line: string) => {
      errors.push(line);
    };
    try {
      const poll = startSpacelabMinutePoll({
        pluginUrl: "http://127.0.0.1:9",
        pluginToken: "token",
        scheduleInitialTick: false,
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
            return new Response(JSON.stringify({ guildIds: ["guild-a"] }), {
              status: 200,
            });
          }
          if (url.pathname.endsWith("/cycle-state")) {
            return new Response(JSON.stringify({}), { status: 200 });
          }
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        },
        setIntervalImpl: () =>
          ({
            unref() {},
          }) as ReturnType<typeof setInterval>,
        runCycle: async () => {
          throw new Error("cycle_state_failed:403");
        },
      });
      await poll.tick();
      assert.ok(errors.some((line) => line.includes("cycle_state_failed:403")));
    } finally {
      console.error = originalError;
    }
  });
});
