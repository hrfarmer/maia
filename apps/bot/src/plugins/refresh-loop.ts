import {
  getLatestPluginScan,
  getPluginRefreshRequestedAt,
  isPluginRefreshPending,
  type Db,
} from "@maia/db";
import { runPluginScan } from "./run-scan.js";

const REFRESH_POLL_MS = 2_000;

export function startPluginRefreshLoop(db: Db) {
  const timer = setInterval(() => {
    void (async () => {
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
      await runPluginScan(db, "refresh");
    })().catch((error) => {
      console.error("Plugin refresh scan failed", error);
    });
  }, REFRESH_POLL_MS);

  timer.unref?.();
  return timer;
}
