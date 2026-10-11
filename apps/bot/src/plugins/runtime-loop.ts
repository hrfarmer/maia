import {
  claimNextPluginRunRequest,
  completePluginRunRequest,
  getLatestOkPluginsByPluginId,
  type Db,
} from "@maia/db";
import { executePluginRun } from "./execute-run.js";
import type { PluginTokenRegistry } from "./token-registry.js";

const RUN_POLL_MS = 1_000;

export function startPluginRuntimeLoop(
  db: Db,
  input: {
    tokenRegistry: PluginTokenRegistry;
    pluginApiUrl: string;
    log?: (line: string) => void;
  },
) {
  const log = input.log ?? console.log;

  const timer = setInterval(() => {
    void (async () => {
      const claimed = await claimNextPluginRunRequest(db);
      if (!claimed) {
        return;
      }

      const plugins = await getLatestOkPluginsByPluginId(db);
      const plugin = plugins.get(claimed.pluginId);
      if (!plugin) {
        await completePluginRunRequest(db, claimed.id);
        return;
      }

      const trigger =
        claimed.trigger === "cron" ? "cron" : ("run_now" as const);

      await executePluginRun({
        db,
        runRequestId: claimed.id,
        guildId: claimed.guildId,
        plugin,
        pluginApiUrl: input.pluginApiUrl,
        tokenRegistry: input.tokenRegistry,
        log,
        trigger,
      });
    })().catch((error) => {
      console.error("Plugin run failed", error);
    });
  }, RUN_POLL_MS);

  timer.unref?.();
  return timer;
}
