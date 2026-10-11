import { discoverPlugins } from "@maia/plugins";
import {
  clearPluginRefreshRequest,
  persistPluginScan,
  pruneGuildPluginConfigForRemovedPlugins,
  type Db,
  type PluginScanTrigger,
} from "@maia/db";

export async function runPluginScan(db: Db, trigger: PluginScanTrigger) {
  try {
    const discovered = await discoverPlugins();
    const activePluginIds = discovered
      .filter((entry) => entry.status === "ok" && entry.manifest)
      .map((entry) => entry.manifest!.id);
    await persistPluginScan(db, {
      trigger,
      plugins: discovered.map((entry) => ({
        directoryName: entry.directoryName,
        status: entry.status,
        pluginId: entry.manifest?.id ?? entry.pluginId,
        displayName: entry.manifest?.name ?? null,
        lifetime: entry.manifest?.lifetime ?? null,
        subscribedEvents: entry.manifest?.subscribedEvents ?? [],
        errorMessage: entry.errorMessage,
        command: entry.manifest?.command ?? null,
        environment: entry.manifest?.environment ?? null,
        invocationTimeLimitMs: entry.manifest?.invocationTimeLimitMs ?? null,
      })),
    });
    await pruneGuildPluginConfigForRemovedPlugins(db, activePluginIds);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Plugin scan failed";
    await persistPluginScan(db, {
      trigger,
      scanError: message,
      plugins: [],
    });
  }

  if (trigger === "refresh") {
    await clearPluginRefreshRequest(db);
  }
}
