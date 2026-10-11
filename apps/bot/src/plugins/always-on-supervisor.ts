import path from "node:path";
import {
  buildAlwaysOnPluginProcessEnvironment,
  resolvePluginsDirectory,
  spawnSupervisedPluginProcess,
  type SupervisedPluginProcessHandle,
} from "@maia/plugins";
import {
  getLatestOkPluginsByPluginId,
  type Db,
  type LatestRunnablePlugin,
} from "@maia/db";
import { formatPluginLogLine } from "./plugin-run-audit.js";
import type { PluginTokenRegistry } from "./token-registry.js";

export interface AlwaysOnSupervisorOptions {
  db: Db;
  tokenRegistry: PluginTokenRegistry;
  pluginApiUrl: string;
  log?: (line: string) => void;
  listAlwaysOnPlugins?: () => Promise<LatestRunnablePlugin[]>;
  spawnSupervised?: typeof spawnSupervisedPluginProcess;
}

interface ManagedAlwaysOnProcess {
  plugin: LatestRunnablePlugin;
  handle: SupervisedPluginProcessHandle;
  token: string;
  stopping: boolean;
}

export class AlwaysOnSupervisor {
  private readonly db: Db;
  private readonly tokenRegistry: PluginTokenRegistry;
  private readonly pluginApiUrl: string;
  private readonly log: (line: string) => void;
  private readonly listAlwaysOnPlugins: () => Promise<LatestRunnablePlugin[]>;
  private readonly spawnSupervised: typeof spawnSupervisedPluginProcess;
  private readonly processes = new Map<string, ManagedAlwaysOnProcess>();

  constructor(options: AlwaysOnSupervisorOptions) {
    this.db = options.db;
    this.tokenRegistry = options.tokenRegistry;
    this.pluginApiUrl = options.pluginApiUrl;
    this.log = options.log ?? console.log;
    this.spawnSupervised =
      options.spawnSupervised ?? spawnSupervisedPluginProcess;
    this.listAlwaysOnPlugins =
      options.listAlwaysOnPlugins ??
      (async () => {
        const plugins = await getLatestOkPluginsByPluginId(this.db);
        return [...plugins.values()].filter(
          (plugin) => plugin.lifetime === "always-on",
        );
      });
  }

  writeStdin(pluginId: string, line: string) {
    this.processes.get(pluginId)?.handle.writeStdin(line);
  }

  async shutdown() {
    for (const pluginId of [...this.processes.keys()]) {
      await this.stopPlugin(pluginId);
    }
  }

  async syncFromLatestScan(input: { restartExisting: boolean }) {
    const alwaysOn = await this.listAlwaysOnPlugins();
    const activeIds = new Set(alwaysOn.map((plugin) => plugin.pluginId));

    for (const pluginId of this.processes.keys()) {
      if (!activeIds.has(pluginId)) {
        await this.stopPlugin(pluginId);
      }
    }

    for (const plugin of alwaysOn) {
      const existing = this.processes.get(plugin.pluginId);
      if (existing && !input.restartExisting) {
        continue;
      }
      if (existing) {
        await this.restartPlugin(plugin);
      } else {
        await this.startPlugin(plugin);
      }
    }
  }

  private async startPlugin(plugin: LatestRunnablePlugin) {
    const token = this.tokenRegistry.mintAlwaysOnToken(plugin.pluginId);
    const pluginsDir = resolvePluginsDirectory();
    const cwd = path.join(pluginsDir, plugin.directoryName);
    const env = buildAlwaysOnPluginProcessEnvironment({
      pluginToken: token,
      pluginUrl: this.pluginApiUrl,
    });
    const pluginId = plugin.pluginId;

    const handle = this.spawnSupervised({
      cwd,
      command: plugin.command,
      env,
      log: {
        onStdout: (chunk) =>
          this.log(formatPluginLogLine(pluginId, "stdout", chunk)),
        onStderr: (chunk) =>
          this.log(formatPluginLogLine(pluginId, "stderr", chunk)),
      },
    });

    const managed: ManagedAlwaysOnProcess = {
      plugin,
      handle,
      token,
      stopping: false,
    };
    this.processes.set(pluginId, managed);

    void handle.waitForExit().then(() => {
      void this.handleUnexpectedExit(pluginId);
    });
  }

  private async restartPlugin(plugin: LatestRunnablePlugin) {
    await this.stopPlugin(plugin.pluginId);
    await this.startPlugin(plugin);
  }

  private async stopPlugin(pluginId: string) {
    const managed = this.processes.get(pluginId);
    if (!managed) {
      return;
    }
    managed.stopping = true;
    this.processes.delete(pluginId);
    managed.handle.kill("SIGTERM");
    await managed.handle.waitForExit().catch(() => ({
      exitCode: null,
      signal: null,
    }));
    this.tokenRegistry.revoke(managed.token);
  }

  private async handleUnexpectedExit(pluginId: string) {
    const managed = this.processes.get(pluginId);
    if (!managed || managed.stopping) {
      return;
    }
    const token = managed.token;
    this.processes.delete(pluginId);
    this.tokenRegistry.revoke(token);

    const alwaysOn = await this.listAlwaysOnPlugins();
    const plugin = alwaysOn.find((entry) => entry.pluginId === pluginId);
    if (!plugin) {
      return;
    }
    await this.startPlugin(plugin);
  }
}
