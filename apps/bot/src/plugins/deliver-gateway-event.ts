import {
  buildPluginGatewayEventStdin,
  listPluginsSubscribedToEvent,
} from "@maia/plugins";
import {
  getLatestOkPluginsByPluginId,
  listGuildPluginSettingsForGuild,
  type Db,
  type LatestRunnablePlugin,
} from "@maia/db";
import type { AlwaysOnSupervisor } from "./always-on-supervisor.js";
import { executePluginEventRun } from "./execute-event-run.js";
import type { PluginEventInvocationConcurrency } from "./event-invocation-concurrency.js";
import type { PluginTokenRegistry } from "./token-registry.js";

export interface DeliverMemberRoleGatewayEventInput {
  db: Db;
  guildId: string;
  event: string;
  payload: unknown;
  alwaysOnSupervisor: AlwaysOnSupervisor;
  tokenRegistry: PluginTokenRegistry;
  pluginApiUrl: string;
  concurrency: PluginEventInvocationConcurrency;
  log: (line: string) => void;
  getPlugins?: typeof getLatestOkPluginsByPluginId;
  listSettings?: typeof listGuildPluginSettingsForGuild;
  runInvocationEvent?: typeof executePluginEventRun;
}

export interface DeliverAlwaysOnGatewayEventInput {
  db: Db;
  guildId: string;
  event: string;
  payload: unknown;
  alwaysOnSupervisor: AlwaysOnSupervisor;
  getPlugins?: typeof getLatestOkPluginsByPluginId;
  listSettings?: typeof listGuildPluginSettingsForGuild;
}

/** Message and reaction events: always-on stdin only (no invocation runs). */
export async function deliverAlwaysOnGatewayEvent(
  input: DeliverAlwaysOnGatewayEventInput,
) {
  const getPlugins = input.getPlugins ?? getLatestOkPluginsByPluginId;
  const listSettings = input.listSettings ?? listGuildPluginSettingsForGuild;

  const plugins = await getPlugins(input.db);
  const settings = await listSettings(input.db, input.guildId);
  const enabledPluginIds = settings
    .filter((row) => row.enabled)
    .map((row) => row.pluginId);

  const targets = listPluginsSubscribedToEvent(
    plugins.values(),
    enabledPluginIds,
    input.event,
  );

  const stdinLine = buildPluginGatewayEventStdin(
    input.guildId,
    input.event,
    input.payload,
  );

  for (const plugin of targets) {
    if (plugin.lifetime !== "always-on") {
      continue;
    }
    input.alwaysOnSupervisor.writeStdin(plugin.pluginId, stdinLine);
  }
}

export async function deliverMemberRoleGatewayEvent(
  input: DeliverMemberRoleGatewayEventInput,
) {
  const getPlugins = input.getPlugins ?? getLatestOkPluginsByPluginId;
  const listSettings = input.listSettings ?? listGuildPluginSettingsForGuild;
  const runInvocationEvent = input.runInvocationEvent ?? executePluginEventRun;

  const plugins = await getPlugins(input.db);
  const settings = await listSettings(input.db, input.guildId);
  const enabledPluginIds = settings
    .filter((row) => row.enabled)
    .map((row) => row.pluginId);

  const targets = listPluginsSubscribedToEvent(
    plugins.values(),
    enabledPluginIds,
    input.event,
  );

  const stdinLine = buildPluginGatewayEventStdin(
    input.guildId,
    input.event,
    input.payload,
  );

  for (const plugin of targets) {
    if (plugin.lifetime === "always-on") {
      input.alwaysOnSupervisor.writeStdin(plugin.pluginId, stdinLine);
      continue;
    }

    void runInvocationEvent({
      db: input.db,
      guildId: input.guildId,
      event: input.event,
      payload: input.payload,
      plugin,
      pluginApiUrl: input.pluginApiUrl,
      tokenRegistry: input.tokenRegistry,
      concurrency: input.concurrency,
      log: input.log,
    }).catch((error) => {
      console.error("Plugin event invocation failed", error);
    });
  }
}

export function pluginTargetsForTest(
  plugins: Map<string, LatestRunnablePlugin>,
  enabledPluginIds: string[],
  event: string,
): LatestRunnablePlugin[] {
  return listPluginsSubscribedToEvent(
    plugins.values(),
    enabledPluginIds,
    event,
  );
}
