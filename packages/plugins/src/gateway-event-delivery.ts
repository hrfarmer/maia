import type { PluginEvent } from "./events.js";
import {
  DEFAULT_MAX_CONCURRENT_INVOCATIONS,
  type PluginManifest,
} from "./manifest.js";

export interface PluginGatewayEventStdin {
  guildId: string;
  event: PluginEvent;
  payload: unknown;
}

export function buildPluginGatewayEventStdin(
  guildId: string,
  event: string,
  payload: unknown,
): string {
  const line: PluginGatewayEventStdin = {
    guildId,
    event: event as PluginEvent,
    payload,
  };
  return `${JSON.stringify(line)}\n`;
}

export interface PluginEventRoutingCandidate {
  pluginId: string;
  lifetime: string;
  subscribedEvents: readonly string[];
}

export function listPluginsSubscribedToEvent<
  T extends PluginEventRoutingCandidate,
>(plugins: Iterable<T>, enabledPluginIds: Iterable<string>, event: string): T[] {
  const enabled = new Set(enabledPluginIds);
  const targets: T[] = [];
  for (const plugin of plugins) {
    if (!enabled.has(plugin.pluginId)) {
      continue;
    }
    if (!plugin.subscribedEvents.includes(event)) {
      continue;
    }
    targets.push(plugin);
  }
  return targets;
}

export function resolveMaxConcurrentInvocations(
  manifest: Pick<PluginManifest, "lifetime" | "maxConcurrentInvocations">,
): number {
  if (manifest.lifetime === "always-on") {
    return DEFAULT_MAX_CONCURRENT_INVOCATIONS;
  }
  return manifest.maxConcurrentInvocations ?? DEFAULT_MAX_CONCURRENT_INVOCATIONS;
}
