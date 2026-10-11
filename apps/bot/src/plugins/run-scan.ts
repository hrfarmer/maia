import { discoverPlugins } from "@maia/plugins";
import {
  clearPluginRefreshRequest,
  persistPluginScan,
  type Db,
  type PluginScanTrigger,
} from "@maia/db";

export async function runPluginScan(db: Db, trigger: PluginScanTrigger) {
  try {
    const discovered = await discoverPlugins();
    await persistPluginScan(db, {
      trigger,
      plugins: discovered.map((entry) => ({
        directoryName: entry.directoryName,
        status: entry.status,
        pluginId: entry.manifest?.id ?? null,
        name: entry.manifest?.name ?? null,
        version: entry.manifest?.version ?? null,
        errorMessage: entry.errorMessage,
      })),
    });
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
