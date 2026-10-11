import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Db, LatestRunnablePlugin } from "@maia/db";
import { AlwaysOnSupervisor } from "./always-on-supervisor.js";
import { deliverMemberRoleGatewayEvent } from "./deliver-gateway-event.js";
import { executePluginEventRun } from "./execute-event-run.js";
import { PluginEventInvocationConcurrency } from "./event-invocation-concurrency.js";
import { PluginTokenRegistry } from "./token-registry.js";

function invocationPlugin(
  overrides: Partial<LatestRunnablePlugin> = {},
): LatestRunnablePlugin {
  return {
    pluginId: "inv",
    directoryName: ".",
    lifetime: "invocation",
    command: ["node", "index.js"],
    environment: [],
    invocationTimeLimitMs: 60_000,
    subscribedEvents: ["member.join"],
    maxConcurrentInvocations: 8,
    ...overrides,
  };
}

function alwaysOnPlugin(
  overrides: Partial<LatestRunnablePlugin> = {},
): LatestRunnablePlugin {
  return {
    pluginId: "ao",
    directoryName: ".",
    lifetime: "always-on",
    command: ["node", "index.js"],
    environment: [],
    invocationTimeLimitMs: null,
    subscribedEvents: ["member.join"],
    maxConcurrentInvocations: 8,
    ...overrides,
  };
}

describe("deliverMemberRoleGatewayEvent", () => {
  it("starts an invocation run for a subscribed enabled plugin", async () => {
    const runs: Array<{ event: string; guildId: string }> = [];
    await deliverMemberRoleGatewayEvent({
      db: {} as Db,
      guildId: "111",
      event: "member.join",
      payload: { id: "u1" },
      alwaysOnSupervisor: new AlwaysOnSupervisor({
        db: {} as Db,
        tokenRegistry: new PluginTokenRegistry(),
        pluginApiUrl: "http://127.0.0.1:3847",
        listAlwaysOnPlugins: async () => [],
        spawnSupervised: () => ({
          writeStdin() {},
          kill() {},
          waitForExit: () => new Promise(() => {}),
        }),
      }),
      tokenRegistry: new PluginTokenRegistry(),
      pluginApiUrl: "http://127.0.0.1:3847",
      concurrency: new PluginEventInvocationConcurrency(),
      log: () => {},
      getPlugins: async () =>
        new Map([["inv", invocationPlugin()]]),
      listSettings: async () => [
        { guildId: "111", pluginId: "inv", enabled: true, cronExpression: null },
      ],
      runInvocationEvent: async (input) => {
        runs.push({ event: input.event, guildId: input.guildId });
        return true;
      },
    });
    assert.deepEqual(runs, [{ event: "member.join", guildId: "111" }]);
  });

  it("writes always-on events on stdin without starting invocation", async () => {
    const stdinLines: string[] = [];
    const supervisor = new AlwaysOnSupervisor({
      db: {} as Db,
      tokenRegistry: new PluginTokenRegistry(),
      pluginApiUrl: "http://127.0.0.1:3847",
      listAlwaysOnPlugins: async () => [alwaysOnPlugin()],
      spawnSupervised: () => ({
        writeStdin(line: string) {
          stdinLines.push(line);
        },
        kill() {},
        waitForExit: () => new Promise(() => {}),
      }),
    });
    await supervisor.syncFromLatestScan({ restartExisting: false });

    let invocationRuns = 0;
    await deliverMemberRoleGatewayEvent({
      db: {} as Db,
      guildId: "111",
      event: "member.join",
      payload: { id: "u1" },
      alwaysOnSupervisor: supervisor,
      tokenRegistry: new PluginTokenRegistry(),
      pluginApiUrl: "http://127.0.0.1:3847",
      concurrency: new PluginEventInvocationConcurrency(),
      log: () => {},
      getPlugins: async () => new Map([["ao", alwaysOnPlugin()]]),
      listSettings: async () => [
        { guildId: "111", pluginId: "ao", enabled: true, cronExpression: null },
      ],
      runInvocationEvent: async () => {
        invocationRuns += 1;
        return true;
      },
    });

    assert.equal(invocationRuns, 0);
    assert.equal(stdinLines.length, 1);
    assert.match(stdinLines[0] ?? "", /"event":"member.join"/);
    await supervisor.shutdown();
  });

  it("skips plugins that are disabled or not subscribed", async () => {
    let runs = 0;
    await deliverMemberRoleGatewayEvent({
      db: {} as Db,
      guildId: "111",
      event: "member.join",
      payload: {},
      alwaysOnSupervisor: new AlwaysOnSupervisor({
        db: {} as Db,
        tokenRegistry: new PluginTokenRegistry(),
        pluginApiUrl: "http://127.0.0.1:3847",
        listAlwaysOnPlugins: async () => [],
        spawnSupervised: () => ({
          writeStdin() {},
          kill() {},
          waitForExit: () => new Promise(() => {}),
        }),
      }),
      tokenRegistry: new PluginTokenRegistry(),
      pluginApiUrl: "http://127.0.0.1:3847",
      concurrency: new PluginEventInvocationConcurrency(),
      log: () => {},
      getPlugins: async () =>
        new Map([
          ["inv", invocationPlugin({ subscribedEvents: ["member.leave"] })],
        ]),
      listSettings: async () => [
        { guildId: "111", pluginId: "inv", enabled: false, cronExpression: null },
      ],
      runInvocationEvent: async () => {
        runs += 1;
        return true;
      },
    });
    assert.equal(runs, 0);
  });

  it("drops invocation events when the cap is full", async () => {
    const concurrency = new PluginEventInvocationConcurrency();
    concurrency.tryAcquire("inv", 1);
    let runs = 0;
    const db = {
      query: {
        guildPluginSettings: {
          findFirst: async () => ({ enabled: true }),
        },
        guildPluginEnvValues: {
          findMany: async () => [],
        },
      },
    } as unknown as Db;
    await deliverMemberRoleGatewayEvent({
      db,
      guildId: "111",
      event: "member.join",
      payload: {},
      alwaysOnSupervisor: new AlwaysOnSupervisor({
        db: {} as Db,
        tokenRegistry: new PluginTokenRegistry(),
        pluginApiUrl: "http://127.0.0.1:3847",
        listAlwaysOnPlugins: async () => [],
        spawnSupervised: () => ({
          writeStdin() {},
          kill() {},
          waitForExit: () => new Promise(() => {}),
        }),
      }),
      tokenRegistry: new PluginTokenRegistry(),
      pluginApiUrl: "http://127.0.0.1:3847",
      concurrency,
      log: () => {},
      getPlugins: async () =>
        new Map([["inv", invocationPlugin({ maxConcurrentInvocations: 1 })]]),
      listSettings: async () => [
        { guildId: "111", pluginId: "inv", enabled: true, cronExpression: null },
      ],
      runInvocationEvent: (input) =>
        executePluginEventRun({
          ...input,
          runProcess: async () => {
            runs += 1;
            return { exitCode: 0, signal: null, timedOut: false };
          },
        }),
    });
    assert.equal(runs, 0);
  });
});
