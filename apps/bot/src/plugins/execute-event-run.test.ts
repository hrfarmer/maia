import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Db, LatestRunnablePlugin } from "@maia/db";
import { executePluginEventRun } from "./execute-event-run.js";
import { PluginEventInvocationConcurrency } from "./event-invocation-concurrency.js";
import { PluginTokenRegistry } from "./token-registry.js";

const plugin: LatestRunnablePlugin = {
  pluginId: "inv",
  directoryName: ".",
  lifetime: "invocation",
  command: ["node", "index.js"],
  environment: [],
  invocationTimeLimitMs: 60_000,
  subscribedEvents: ["member.join"],
  maxConcurrentInvocations: 8,
};

describe("executePluginEventRun", () => {
  it("passes guild, event, and payload on stdin without audit", async () => {
    let seenStdin = "";
    const concurrency = new PluginEventInvocationConcurrency();
    const started = await executePluginEventRun({
      db: {
        query: {
          guildPluginSettings: {
            findFirst: async () => ({ enabled: true }),
          },
          guildPluginEnvValues: {
            findMany: async () => [],
          },
        },
      } as unknown as Db,
      guildId: "111",
      event: "member.join",
      payload: { userId: "9" },
      plugin,
      pluginApiUrl: "http://127.0.0.1:3847",
      tokenRegistry: new PluginTokenRegistry(),
      concurrency,
      log: () => {},
      runProcess: async (input) => {
        seenStdin = input.stdin;
        return { exitCode: 0, signal: null, timedOut: false };
      },
    });
    assert.equal(started, true);
    assert.match(seenStdin, /"event":"member.join"/);
    assert.match(seenStdin, /"guildId":"111"/);
    assert.match(seenStdin, /"userId":"9"/);
    assert.equal(concurrency.activeCount("inv"), 0);
  });

  it("returns false when the concurrency cap is full", async () => {
    const concurrency = new PluginEventInvocationConcurrency();
    concurrency.tryAcquire("inv", 1);
    const started = await executePluginEventRun({
      db: {
        query: {
          guildPluginSettings: {
            findFirst: async () => ({ enabled: true }),
          },
          guildPluginEnvValues: {
            findMany: async () => [],
          },
        },
      } as unknown as Db,
      guildId: "111",
      event: "member.join",
      payload: {},
      plugin: { ...plugin, maxConcurrentInvocations: 1 },
      pluginApiUrl: "http://127.0.0.1:3847",
      tokenRegistry: new PluginTokenRegistry(),
      concurrency,
      log: () => {},
      runProcess: async () => ({
        exitCode: 0,
        signal: null,
        timedOut: false,
      }),
    });
    assert.equal(started, false);
  });
});
