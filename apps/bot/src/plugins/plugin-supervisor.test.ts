import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Db, LatestRunnablePlugin } from "@maia/db";
import {
  buildAlwaysOnPluginProcessEnvironment,
  type SupervisedPluginProcessHandle,
} from "@maia/plugins";
import { AlwaysOnSupervisor } from "./always-on-supervisor.js";
import { PluginTokenRegistry } from "./token-registry.js";

const demoPlugin = (): LatestRunnablePlugin => ({
  pluginId: "demo-always-on",
  directoryName: ".",
  lifetime: "always-on",
  command: ["noop"],
  environment: [],
  invocationTimeLimitMs: null,
  subscribedEvents: [],
  maxConcurrentInvocations: 8,
});

function mockHandle(input: {
  onKill?: () => void;
  stdinLines?: string[];
  waitForExit?: () => Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>;
}): SupervisedPluginProcessHandle {
  const stdinLines = input.stdinLines ?? [];
  let resolveExit:
    | ((value: { exitCode: number | null; signal: NodeJS.Signals | null }) => void)
    | undefined;
  const exitPromise =
    input.waitForExit?.() ??
    new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>(
      (resolve) => {
        resolveExit = resolve;
      },
    );
  return {
    writeStdin(line: string) {
      stdinLines.push(line);
    },
    kill() {
      input.onKill?.();
      resolveExit?.({ exitCode: 0, signal: "SIGTERM" });
    },
    waitForExit: () => exitPromise,
  };
}

describe("AlwaysOnSupervisor", () => {
  it("starts one process per always-on plugin without a second on resync", async () => {
    let spawnCount = 0;
    const supervisor = new AlwaysOnSupervisor({
      db: {} as Db,
      tokenRegistry: new PluginTokenRegistry(),
      pluginApiUrl: "http://127.0.0.1:3847",
      listAlwaysOnPlugins: async () => [demoPlugin()],
      spawnSupervised: () => {
        spawnCount += 1;
        return mockHandle({});
      },
    });

    await supervisor.syncFromLatestScan({ restartExisting: false });
    await supervisor.syncFromLatestScan({ restartExisting: false });
    await supervisor.shutdown();
    assert.equal(spawnCount, 1);
  });

  it("restarts existing processes when refresh requests it", async () => {
    let spawnCount = 0;
    const supervisor = new AlwaysOnSupervisor({
      db: {} as Db,
      tokenRegistry: new PluginTokenRegistry(),
      pluginApiUrl: "http://127.0.0.1:3847",
      listAlwaysOnPlugins: async () => [demoPlugin()],
      spawnSupervised: () => {
        spawnCount += 1;
        return mockHandle({});
      },
    });

    await supervisor.syncFromLatestScan({ restartExisting: false });
    await supervisor.syncFromLatestScan({ restartExisting: true });
    await supervisor.shutdown();
    assert.equal(spawnCount, 2);
  });

  it("uses always-on env without guild values", async () => {
    let seenEnv: Record<string, string> | undefined;
    const supervisor = new AlwaysOnSupervisor({
      db: {} as Db,
      tokenRegistry: new PluginTokenRegistry(),
      pluginApiUrl: "http://127.0.0.1:3847",
      listAlwaysOnPlugins: async () => [demoPlugin()],
      spawnSupervised: (input) => {
        seenEnv = input.env;
        return mockHandle({});
      },
    });

    await supervisor.syncFromLatestScan({ restartExisting: false });
    await supervisor.shutdown();
    assert.ok(seenEnv);
    assert.deepEqual(
      seenEnv,
      buildAlwaysOnPluginProcessEnvironment({
        pluginToken: seenEnv!.MAIA_PLUGIN_TOKEN,
        pluginUrl: "http://127.0.0.1:3847",
      }),
    );
  });

  it("forwards stdin lines to the running process", async () => {
    const stdinLines: string[] = [];
    const supervisor = new AlwaysOnSupervisor({
      db: {} as Db,
      tokenRegistry: new PluginTokenRegistry(),
      pluginApiUrl: "http://127.0.0.1:3847",
      listAlwaysOnPlugins: async () => [demoPlugin()],
      spawnSupervised: () => mockHandle({ stdinLines }),
    });
    await supervisor.syncFromLatestScan({ restartExisting: false });
    supervisor.writeStdin(
      "demo-always-on",
      '{"guildId":"1","change":"enabled"}\n',
    );
    await supervisor.shutdown();
    assert.deepEqual(stdinLines, ['{"guildId":"1","change":"enabled"}\n']);
  });

  it("stops processes when the plugin disappears from discovery", async () => {
    let killed = false;
    let plugins: LatestRunnablePlugin[] = [demoPlugin()];
    const supervisor = new AlwaysOnSupervisor({
      db: {} as Db,
      tokenRegistry: new PluginTokenRegistry(),
      pluginApiUrl: "http://127.0.0.1:3847",
      listAlwaysOnPlugins: async () => plugins,
      spawnSupervised: () =>
        mockHandle({
          onKill: () => {
            killed = true;
          },
        }),
    });

    await supervisor.syncFromLatestScan({ restartExisting: false });
    plugins = [];
    await supervisor.syncFromLatestScan({ restartExisting: false });
    await supervisor.shutdown();
    assert.equal(killed, true);
  });

  it("keeps the previous always-on token valid until the old process exits on restart", async () => {
    const registry = new PluginTokenRegistry();
    const tokens: string[] = [];
    let releaseFirstExit: (() => void) | undefined;
    const supervisor = new AlwaysOnSupervisor({
      db: {} as Db,
      tokenRegistry: registry,
      pluginApiUrl: "http://127.0.0.1:3847",
      listAlwaysOnPlugins: async () => [demoPlugin()],
      spawnSupervised: (input) => {
        tokens.push(input.env.MAIA_PLUGIN_TOKEN);
        if (tokens.length === 1) {
          return mockHandle({
            waitForExit: () =>
              new Promise((resolve) => {
                releaseFirstExit = () =>
                  resolve({ exitCode: 0, signal: "SIGTERM" });
              }),
          });
        }
        return mockHandle({});
      },
    });

    await supervisor.syncFromLatestScan({ restartExisting: false });
    const firstToken = tokens[0];
    assert.ok(firstToken);
    assert.ok(registry.lookup(firstToken));

    const restartPromise = supervisor.syncFromLatestScan({ restartExisting: true });
    assert.ok(
      registry.lookup(firstToken),
      "old token must work while process shuts down",
    );
    releaseFirstExit?.();
    await restartPromise;
    assert.equal(registry.lookup(firstToken), null);
    assert.ok(registry.lookup(tokens[1]!));

    await supervisor.shutdown();
  });

  it("starts the process again after an unexpected exit", async () => {
    let spawnCount = 0;
    const exitResolvers: Array<() => void> = [];
    const supervisor = new AlwaysOnSupervisor({
      db: {} as Db,
      tokenRegistry: new PluginTokenRegistry(),
      pluginApiUrl: "http://127.0.0.1:3847",
      listAlwaysOnPlugins: async () => [demoPlugin()],
      spawnSupervised: () => {
        spawnCount += 1;
        if (spawnCount === 1) {
          return mockHandle({
            waitForExit: () =>
              new Promise((resolve) => {
                exitResolvers.push(() => resolve({ exitCode: 0, signal: null }));
              }),
          });
        }
        return mockHandle({});
      },
    });

    await supervisor.syncFromLatestScan({ restartExisting: false });
    assert.equal(spawnCount, 1);
    exitResolvers[0]?.();
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(spawnCount, 2);
    await supervisor.shutdown();
  });
});
