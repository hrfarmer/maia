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
});
