import {
  enqueuePluginRun,
  listGuildPluginCronTargetRows,
  type Db,
} from "@maia/db";
import { dueCronTargets } from "@maia/plugins";

export const PLUGIN_CRON_TICK_MS = 60_000;

export interface PluginCronClock {
  now(): Date;
}

export async function runPluginCronTick(
  db: Db,
  clock: PluginCronClock,
  deps?: {
    enqueue?: typeof enqueuePluginRun;
    listTargets?: typeof listGuildPluginCronTargetRows;
  },
) {
  const listTargets = deps?.listTargets ?? listGuildPluginCronTargetRows;
  const enqueue = deps?.enqueue ?? enqueuePluginRun;
  const at = clock.now();
  const targets = await listTargets(db);
  const due = dueCronTargets(targets, at);
  for (const entry of due) {
    await enqueue(db, entry.guildId, entry.pluginId, "cron");
  }
}

export function startPluginCronLoop(
  db: Db,
  input?: {
    clock?: PluginCronClock;
    enqueue?: typeof enqueuePluginRun;
    tickMs?: number;
  },
) {
  const clock = input?.clock ?? { now: () => new Date() };
  const tickMs = input?.tickMs ?? PLUGIN_CRON_TICK_MS;
  const deps = {
    enqueue: input?.enqueue,
    listTargets: undefined as typeof listGuildPluginCronTargetRows | undefined,
  };

  const runTick = () => {
    void runPluginCronTick(db, clock, deps).catch((error) => {
      console.error("Plugin cron tick failed", error);
    });
  };

  const now = clock.now();
  const delay =
    tickMs -
    ((now.getUTCSeconds() * 1_000 + now.getUTCMilliseconds()) % tickMs);

  const alignTimer = setTimeout(() => {
    runTick();
    const interval = setInterval(runTick, tickMs);
    interval.unref?.();
  }, delay);
  alignTimer.unref?.();

  return alignTimer;
}
