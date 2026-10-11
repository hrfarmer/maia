import path from "node:path";
import {
  buildPluginGatewayEventStdin,
  buildPluginProcessEnvironment,
  resolvePluginsDirectory,
  runPluginProcess,
} from "@maia/plugins";
import {
  getGuildPluginSettings,
  listGuildPluginEnvValues,
  type Db,
  type LatestRunnablePlugin,
} from "@maia/db";
import { formatPluginLogLine } from "./plugin-run-audit.js";
import type { PluginEventInvocationConcurrency } from "./event-invocation-concurrency.js";
import type { PluginTokenRegistry } from "./token-registry.js";

export interface ExecutePluginEventRunInput {
  db: Db;
  guildId: string;
  event: string;
  payload: unknown;
  plugin: LatestRunnablePlugin;
  pluginApiUrl: string;
  tokenRegistry: PluginTokenRegistry;
  concurrency: PluginEventInvocationConcurrency;
  log: (line: string) => void;
  runProcess?: typeof runPluginProcess;
}

export async function executePluginEventRun(
  input: ExecutePluginEventRunInput,
): Promise<boolean> {
  if (input.plugin.lifetime !== "invocation") {
    return false;
  }

  const settings = await getGuildPluginSettings(
    input.db,
    input.guildId,
    input.plugin.pluginId,
  );
  if (!settings?.enabled) {
    return false;
  }

  if (
    !input.concurrency.tryAcquire(
      input.plugin.pluginId,
      input.plugin.maxConcurrentInvocations,
    )
  ) {
    return false;
  }

  const envRows = await listGuildPluginEnvValues(
    input.db,
    input.guildId,
    input.plugin.pluginId,
  );
  const guildValues: Record<string, string> = {};
  for (const row of envRows) {
    guildValues[row.envKey] = row.value;
  }

  const token = input.tokenRegistry.mintInvocationToken(
    input.guildId,
    input.plugin.pluginId,
  );

  const pluginsDir = resolvePluginsDirectory();
  const cwd = path.join(pluginsDir, input.plugin.directoryName);
  const timeLimitMs = input.plugin.invocationTimeLimitMs ?? 60_000;
  const pluginId = input.plugin.pluginId;
  const runProcess = input.runProcess ?? runPluginProcess;

  try {
    const processEnv = buildPluginProcessEnvironment({
      guildValues,
      pluginToken: token,
      pluginUrl: input.pluginApiUrl,
    });

    await runProcess(
      {
        cwd,
        command: input.plugin.command,
        env: processEnv,
        stdin: buildPluginGatewayEventStdin(
          input.guildId,
          input.event,
          input.payload,
        ),
        timeLimitMs,
      },
      {
        onStdout(chunk) {
          input.log(formatPluginLogLine(pluginId, "stdout", chunk));
        },
        onStderr(chunk) {
          input.log(formatPluginLogLine(pluginId, "stderr", chunk));
        },
      },
    );
  } finally {
    input.tokenRegistry.revoke(token);
    input.concurrency.release(pluginId);
  }

  return true;
}
