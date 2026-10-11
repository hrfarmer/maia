import path from "node:path";
import {
  buildManualInvocationStdin,
  buildPluginProcessEnvironment,
  resolvePluginsDirectory,
  runPluginProcess,
} from "@maia/plugins";
import {
  completePluginRunRequest,
  getGuildPluginSettings,
  listGuildPluginEnvValues,
  recordAuditLog,
  type Db,
  type LatestRunnablePlugin,
} from "@maia/db";
import {
  buildPluginRunAuditEntry,
  formatPluginLogLine,
} from "./plugin-run-audit.js";
import type { PluginTokenRegistry } from "./token-registry.js";

export interface ExecutePluginRunInput {
  db: Db;
  runRequestId: string;
  guildId: string;
  plugin: LatestRunnablePlugin;
  pluginApiUrl: string;
  tokenRegistry: PluginTokenRegistry;
  log: (line: string) => void;
}

export async function executePluginRun(input: ExecutePluginRunInput) {
  const settings = await getGuildPluginSettings(
    input.db,
    input.guildId,
    input.plugin.pluginId,
  );
  if (!settings?.enabled || input.plugin.lifetime !== "invocation") {
    await completePluginRunRequest(input.db, input.runRequestId);
    return;
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

  const processEnv = buildPluginProcessEnvironment({
    guildValues,
    pluginToken: token,
    pluginUrl: input.pluginApiUrl,
  });

  const pluginId = input.plugin.pluginId;
  let success = false;
  let errorMessage: string | undefined;

  try {
    const result = await runPluginProcess(
      {
        cwd,
        command: input.plugin.command,
        env: processEnv,
        stdin: buildManualInvocationStdin(input.guildId),
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

    success = result.exitCode === 0 && !result.timedOut;
    if (result.timedOut) {
      errorMessage = "Process exceeded invocation time limit";
    } else if (result.exitCode !== 0) {
      errorMessage = `Process exited with code ${result.exitCode ?? "null"}`;
    }
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Plugin process failed";
    success = false;
  } finally {
    input.tokenRegistry.revoke(token);
  }

  await recordAuditLog(
    input.db,
    buildPluginRunAuditEntry({
      guildId: input.guildId,
      pluginId,
      trigger: "run_now",
      success,
      errorMessage,
    }),
  );

  await completePluginRunRequest(input.db, input.runRequestId);
}
