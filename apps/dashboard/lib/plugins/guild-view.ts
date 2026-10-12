import {
  canEnableGuildPlugin,
  shouldDisableAfterValueChange,
  type PluginEnvironmentKey,
  type PluginSlashCommand,
  type PluginSlashCollision,
} from "@maia/plugins";
import { SPACELAB_ROSTER_PLUGIN_ID } from "@maia/microsoft";

export interface GuildPluginEnvironmentField {
  key: string;
  required: boolean;
  secret: boolean;
  value: string | null;
  hasSecretValue: boolean;
}

export interface GuildPluginViewRow {
  id: string;
  directoryName: string;
  status: "ok" | "error";
  pluginId: string | null;
  displayName: string | null;
  lifetime: string | null;
  subscribedEvents: string[];
  errorMessage: string | null;
  environment: GuildPluginEnvironmentField[];
  enabled: boolean;
  canEnable: boolean;
  canRunNow: boolean;
  showCronControl: boolean;
  cronExpression: string | null;
  slashCommands: PluginSlashCommand[];
  slashCommandsEnabled: boolean;
  showSlashControl: boolean;
  slashPublishError: string | null;
  slashCollisionNotes: PluginSlashCollision[];
  showOutlookMailboxControl: boolean;
  outlookMailboxConnected: boolean;
}

export function buildGuildPluginEnvironmentFields(
  manifestEnvironment: PluginEnvironmentKey[],
  storedValues: Map<string, string>,
): GuildPluginEnvironmentField[] {
  return manifestEnvironment.map((entry) => {
    const stored = storedValues.get(entry.key);
    if (entry.secret) {
      return {
        key: entry.key,
        required: entry.required,
        secret: true,
        value: null,
        hasSecretValue: stored !== undefined && stored.length > 0,
      };
    }
    return {
      key: entry.key,
      required: entry.required,
      secret: false,
      value: stored ?? null,
      hasSecretValue: false,
    };
  });
}

export function mergeGuildPluginRow(input: {
  plugin: {
    id: string;
    directoryName: string;
    status: "ok" | "error";
    pluginId: string | null;
    displayName: string | null;
    lifetime: string | null;
    subscribedEvents: string[];
    errorMessage: string | null;
    environment: PluginEnvironmentKey[] | null;
  };
  enabled: boolean;
  storedValues: Map<string, string>;
  cronExpression?: string | null;
  slashCommands?: PluginSlashCommand[] | null;
  slashCommandsEnabled?: boolean;
  slashPublishError?: string | null;
  slashCollisionNotes?: PluginSlashCollision[] | null;
  outlookMailboxConnected?: boolean;
}): GuildPluginViewRow {
  const environmentKeys = input.plugin.environment ?? [];
  const environment = buildGuildPluginEnvironmentFields(
    environmentKeys,
    input.storedValues,
  );
  const valueMap = new Map(input.storedValues);
  const canEnable =
    input.plugin.status === "ok" &&
    canEnableGuildPlugin(environmentKeys, valueMap);
  const enabled = input.enabled && canEnable;
  const canRunNow =
    enabled && input.plugin.lifetime === "invocation" && input.plugin.status === "ok";
  const showCronControl =
    input.plugin.lifetime === "invocation" && input.plugin.status === "ok";
  const slashCommands = input.slashCommands ?? [];
  const showSlashControl =
    input.plugin.status === "ok" && slashCommands.length > 0;
  const showOutlookMailboxControl =
    input.plugin.status === "ok" &&
    input.plugin.pluginId === SPACELAB_ROSTER_PLUGIN_ID;

  return {
    id: input.plugin.id,
    directoryName: input.plugin.directoryName,
    status: input.plugin.status,
    pluginId: input.plugin.pluginId,
    displayName: input.plugin.displayName,
    lifetime: input.plugin.lifetime,
    subscribedEvents: input.plugin.subscribedEvents,
    errorMessage: input.plugin.errorMessage,
    environment,
    enabled,
    canEnable,
    canRunNow,
    showCronControl,
    cronExpression: input.cronExpression ?? null,
    slashCommands,
    slashCommandsEnabled:
      showSlashControl && enabled && (input.slashCommandsEnabled ?? false),
    showSlashControl,
    slashPublishError: input.slashPublishError ?? null,
    slashCollisionNotes: input.slashCollisionNotes ?? [],
    showOutlookMailboxControl,
    outlookMailboxConnected: showOutlookMailboxControl
      ? (input.outlookMailboxConnected ?? false)
      : false,
  };
}

export function applyGuildPluginValuePatch(input: {
  environment: PluginEnvironmentKey[];
  existingValues: Map<string, string>;
  patch: Record<string, string | null | undefined>;
  requestedEnabled?: boolean;
  previousEnabled?: boolean;
}): {
  values: Map<string, string>;
  enabled: boolean;
} {
  const values = new Map(input.existingValues);
  for (const [key, raw] of Object.entries(input.patch)) {
    if (raw === null || raw === undefined || raw === "") {
      values.delete(key);
      continue;
    }
    values.set(key, raw);
  }

  let enabled = input.requestedEnabled ?? input.previousEnabled ?? false;
  if (shouldDisableAfterValueChange(input.environment, values)) {
    enabled = false;
  } else if (input.requestedEnabled === true) {
    enabled = canEnableGuildPlugin(input.environment, values);
  }

  return { values, enabled };
}
