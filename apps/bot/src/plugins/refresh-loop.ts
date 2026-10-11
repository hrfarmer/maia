import {
  getLatestPluginScan,
  getPluginRefreshRequestedAt,
  isPluginRefreshPending,
  type Db,
} from "@maia/db";
import type { REST } from "discord.js";
import { runPluginScan } from "./run-scan.js";

const REFRESH_POLL_MS = 2_000;

export function startPluginRefreshLoop(
  db: Db,
  hooks?: { afterRefreshScan?: () => Promise<void>; rest?: REST },
) {
  let refreshInFlight = false;
  const timer = setInterval(() => {
    void (async () => {
      if (refreshInFlight) {
        return;
      }
      const [requestedAt, latestScan] = await Promise.all([
        getPluginRefreshRequestedAt(db),
        getLatestPluginScan(db),
      ]);
      const pending = isPluginRefreshPending(
        requestedAt,
        latestScan?.completedAt ?? null,
      );
      if (!pending) {
        return;
      }
      refreshInFlight = true;
      try {
        await runPluginScan(db, "refresh", {
          afterScan: hooks?.afterRefreshScan,
          rest: hooks?.rest,
          republishSlashCommands: Boolean(hooks?.rest),
        });
      } finally {
        refreshInFlight = false;
      }
    })().catch((error) => {
      console.error("Plugin refresh scan failed", error);
    });
  }, REFRESH_POLL_MS);

  timer.unref?.();
  return timer;
}
