import type { PluginEnvironmentKey } from "./manifest.js";

export type GuildPluginValueMap = ReadonlyMap<string, string>;

export function guildHasRequiredEnvValues(
  environment: readonly PluginEnvironmentKey[],
  values: GuildPluginValueMap,
): boolean {
  for (const entry of environment) {
    if (!entry.required) {
      continue;
    }
    const value = values.get(entry.key);
    if (value === undefined || value.length === 0) {
      return false;
    }
  }
  return true;
}

export function canEnableGuildPlugin(
  environment: readonly PluginEnvironmentKey[],
  values: GuildPluginValueMap,
): boolean {
  return guildHasRequiredEnvValues(environment, values);
}

export function shouldDisableAfterValueChange(
  environment: readonly PluginEnvironmentKey[],
  values: GuildPluginValueMap,
): boolean {
  return !guildHasRequiredEnvValues(environment, values);
}

export const MAIA_PLUGIN_TOKEN_ENV = "MAIA_PLUGIN_TOKEN";
export const MAIA_PLUGIN_URL_ENV = "MAIA_PLUGIN_URL";

export function buildPluginProcessEnvironment(input: {
  guildValues: Readonly<Record<string, string>>;
  pluginToken: string;
  pluginUrl: string;
}): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.guildValues)) {
    env[key] = value;
  }
  env[MAIA_PLUGIN_TOKEN_ENV] = input.pluginToken;
  env[MAIA_PLUGIN_URL_ENV] = input.pluginUrl;
  return env;
}

export type PluginRunTrigger = "run_now" | "cron";

export interface ManualInvocationStdin {
  guildId: string;
  trigger: "run_now";
}

export function buildManualInvocationStdin(guildId: string): string {
  const payload: ManualInvocationStdin = { guildId, trigger: "run_now" };
  return `${JSON.stringify(payload)}\n`;
}
