import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Db, LatestRunnablePlugin } from "@maia/db";
import { AlwaysOnSupervisor } from "./always-on-supervisor.js";
import {
  deliverAlwaysOnGatewayEvent,
  deliverMemberRoleGatewayEvent,
} from "./deliver-gateway-event.js";
import { executePluginEventRun } from "./execute-event-run.js";
import { PluginEventInvocationConcurrency } from "./event-invocation-concurrency.js";
import { PluginTokenRegistry } from "./token-registry.js";
import type { SupervisedPluginProcessHandle } from "@maia/plugins";

function mockSupervisedHandle(input?: {
  writeStdin?: (line: string) => void;
}): SupervisedPluginProcessHandle {
  let resolveExit:
    | ((value: { exitCode: number | null; signal: NodeJS.Signals | null }) => void)
    | undefined;
  const exitPromise = new Promise<{
    exitCode: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve) => {
    resolveExit = resolve;
  });
  return {
    writeStdin(line: string) {
      input?.writeStdin?.(line);
    },
    kill() {
      resolveExit?.({ exitCode: 0, signal: "SIGTERM" });
    },
    waitForExit: () => exitPromise,
  };
}

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

describe("deliverAlwaysOnGatewayEvent", () => {
  it("writes stdin for a subscribed enabled always-on plugin with message content", async () => {
    const stdinLines: string[] = [];
    const supervisor = new AlwaysOnSupervisor({
      db: {} as Db,
      tokenRegistry: new PluginTokenRegistry(),
      pluginApiUrl: "http://127.0.0.1:3847",
      listAlwaysOnPlugins: async () => [
        alwaysOnPlugin({ subscribedEvents: ["message.created"] }),
      ],
      spawnSupervised: () =>
        mockSupervisedHandle({
          writeStdin(line: string) {
            stdinLines.push(line);
          },
        }),
    });
    await supervisor.syncFromLatestScan({ restartExisting: false });

    await deliverAlwaysOnGatewayEvent({
      db: {} as Db,
      guildId: "111",
      event: "message.created",
      payload: { id: "m1", content: "hi there" },
      alwaysOnSupervisor: supervisor,
      getPlugins: async () =>
        new Map([
          [
            "ao",
            alwaysOnPlugin({ subscribedEvents: ["message.created"] }),
          ],
        ]),
      listSettings: async () => [
        {
          guildId: "111",
          pluginId: "ao",
          enabled: true,
          cronExpression: null,
          slashCommandsEnabled: false,
          slashPublishError: null,
          slashCollisionNotes: null,
        },
      ],
    });

    assert.equal(stdinLines.length, 1);
    const parsed = JSON.parse(stdinLines[0] ?? "") as {
      guildId: string;
      event: string;
      payload: { content: string };
    };
    assert.equal(parsed.guildId, "111");
    assert.equal(parsed.event, "message.created");
    assert.equal(parsed.payload.content, "hi there");
    await supervisor.shutdown();
  });

  it("does not start invocation for subscribed invocation plugins", async () => {
    let runs = 0;
    await deliverAlwaysOnGatewayEvent({
      db: {} as Db,
      guildId: "111",
      event: "message.created",
      payload: {},
      alwaysOnSupervisor: new AlwaysOnSupervisor({
        db: {} as Db,
        tokenRegistry: new PluginTokenRegistry(),
        pluginApiUrl: "http://127.0.0.1:3847",
        listAlwaysOnPlugins: async () => [],
        spawnSupervised: () => mockSupervisedHandle(),
      }),
      getPlugins: async () =>
        new Map([
          [
            "inv",
            invocationPlugin({ subscribedEvents: ["message.created"] }),
          ],
        ]),
      listSettings: async () => [
        {
          guildId: "111",
          pluginId: "inv",
          enabled: true,
          cronExpression: null,
          slashCommandsEnabled: false,
          slashPublishError: null,
          slashCollisionNotes: null,
        },
      ],
    });
    assert.equal(runs, 0);
  });

  it("skips disabled guilds and unsubscribed always-on plugins", async () => {
    const stdinLines: string[] = [];
    const supervisor = new AlwaysOnSupervisor({
      db: {} as Db,
      tokenRegistry: new PluginTokenRegistry(),
      pluginApiUrl: "http://127.0.0.1:3847",
      listAlwaysOnPlugins: async () => [],
      spawnSupervised: () =>
        mockSupervisedHandle({
          writeStdin(line: string) {
            stdinLines.push(line);
          },
        }),
    });

    await deliverAlwaysOnGatewayEvent({
      db: {} as Db,
      guildId: "111",
      event: "reaction.added",
      payload: {},
      alwaysOnSupervisor: supervisor,
      getPlugins: async () =>
        new Map([
          [
            "ao",
            alwaysOnPlugin({ subscribedEvents: ["reaction.removed"] }),
          ],
        ]),
      listSettings: async () => [
        {
          guildId: "111",
          pluginId: "ao",
          enabled: false,
          cronExpression: null,
          slashCommandsEnabled: false,
          slashPublishError: null,
          slashCollisionNotes: null,
        },
      ],
    });
    assert.equal(stdinLines.length, 0);
  });
});

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
        spawnSupervised: () => mockSupervisedHandle(),
      }),
      tokenRegistry: new PluginTokenRegistry(),
      pluginApiUrl: "http://127.0.0.1:3847",
      concurrency: new PluginEventInvocationConcurrency(),
      log: () => {},
      getPlugins: async () =>
        new Map([["inv", invocationPlugin()]]),
      listSettings: async () => [
        { guildId: "111", pluginId: "inv", enabled: true, cronExpression: null, slashCommandsEnabled: false, slashPublishError: null, slashCollisionNotes: null },
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
      spawnSupervised: () =>
        mockSupervisedHandle({
          writeStdin(line: string) {
            stdinLines.push(line);
          },
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
        { guildId: "111", pluginId: "ao", enabled: true, cronExpression: null, slashCommandsEnabled: false, slashPublishError: null, slashCollisionNotes: null },
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
        spawnSupervised: () => mockSupervisedHandle(),
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
        { guildId: "111", pluginId: "inv", enabled: false, cronExpression: null, slashCommandsEnabled: false, slashPublishError: null, slashCollisionNotes: null },
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
        spawnSupervised: () => mockSupervisedHandle(),
      }),
      tokenRegistry: new PluginTokenRegistry(),
      pluginApiUrl: "http://127.0.0.1:3847",
      concurrency,
      log: () => {},
      getPlugins: async () =>
        new Map([["inv", invocationPlugin({ maxConcurrentInvocations: 1 })]]),
      listSettings: async () => [
        { guildId: "111", pluginId: "inv", enabled: true, cronExpression: null, slashCommandsEnabled: false, slashPublishError: null, slashCollisionNotes: null },
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
