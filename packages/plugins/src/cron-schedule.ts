import { cronMatchesUtcMinute } from "./cron.js";

export interface PluginCronTarget {
  guildId: string;
  pluginId: string;
  cronExpression: string | null;
  enabled: boolean;
  lifetime: string;
}

export function dueCronTargets(
  targets: readonly PluginCronTarget[],
  at: Date,
): Array<{ guildId: string; pluginId: string }> {
  const due: Array<{ guildId: string; pluginId: string }> = [];
  for (const target of targets) {
    if (!target.enabled || target.lifetime !== "invocation") {
      continue;
    }
    const expression = target.cronExpression?.trim();
    if (!expression) {
      continue;
    }
    if (cronMatchesUtcMinute(expression, at)) {
      due.push({ guildId: target.guildId, pluginId: target.pluginId });
    }
  }
  return due;
}
