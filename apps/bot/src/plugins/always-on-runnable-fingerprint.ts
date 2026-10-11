import type { LatestRunnablePlugin } from "@maia/db";

export function alwaysOnRunnableFingerprint(
  plugin: LatestRunnablePlugin,
): string {
  return JSON.stringify({
    directoryName: plugin.directoryName,
    command: plugin.command,
    environment: plugin.environment,
    subscribedEvents: plugin.subscribedEvents,
    invocationTimeLimitMs: plugin.invocationTimeLimitMs,
  });
}

export function alwaysOnRunnableChanged(
  previous: LatestRunnablePlugin,
  next: LatestRunnablePlugin,
): boolean {
  return alwaysOnRunnableFingerprint(previous) !== alwaysOnRunnableFingerprint(next);
}
