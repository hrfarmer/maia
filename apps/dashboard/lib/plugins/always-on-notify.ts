import type { PluginGuildConfigChangeType } from "@maia/db";

export function planAlwaysOnConfigNotifications(input: {
  lifetime: string | null;
  previousEnabled: boolean;
  nextEnabled: boolean;
  valuesChanged: boolean;
}): PluginGuildConfigChangeType[] {
  if (input.lifetime !== "always-on") {
    return [];
  }
  if (input.nextEnabled !== input.previousEnabled) {
    return [input.nextEnabled ? "enabled" : "disabled"];
  }
  if (input.valuesChanged) {
    return ["values_saved"];
  }
  return [];
}
