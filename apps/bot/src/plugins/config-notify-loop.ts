import { buildAlwaysOnGuildConfigStdin } from "@maia/plugins";
import {
  claimNextPluginGuildConfigNotification,
  type Db,
  type PluginGuildConfigChangeType,
} from "@maia/db";
import type { AlwaysOnSupervisor } from "./always-on-supervisor.js";

const NOTIFY_POLL_MS = 500;

export function startPluginConfigNotifyLoop(
  db: Db,
  supervisor: AlwaysOnSupervisor,
) {
  const timer = setInterval(() => {
    void (async () => {
      for (;;) {
        const notification = await claimNextPluginGuildConfigNotification(db);
        if (!notification) {
          return;
        }
        const change = notification.changeType as PluginGuildConfigChangeType;
        const line = buildAlwaysOnGuildConfigStdin(
          notification.guildId,
          change,
        );
        supervisor.writeStdin(notification.pluginId, line);
      }
    })().catch((error) => {
      console.error("Plugin config notify loop failed", error);
    });
  }, NOTIFY_POLL_MS);

  timer.unref?.();
  return timer;
}
