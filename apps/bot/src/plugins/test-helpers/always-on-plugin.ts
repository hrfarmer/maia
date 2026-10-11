import type { LatestRunnablePlugin } from "@maia/db";

export function demoAlwaysOnPlugin(
  overrides: Partial<LatestRunnablePlugin> = {},
): LatestRunnablePlugin {
  return {
    pluginId: "spacelab-roster",
    directoryName: "spacelab-plugins",
    lifetime: "always-on",
    command: ["node", "main.js"],
    environment: [],
    invocationTimeLimitMs: null,
    subscribedEvents: [],
    maxConcurrentInvocations: 8,
    ...overrides,
  };
}
