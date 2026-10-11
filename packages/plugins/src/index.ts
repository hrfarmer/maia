export {
  discoverPlugins,
  type DiscoveredPluginEntry,
  type DiscoveredPluginStatus,
  type DiscoverPluginsOptions,
} from "./discover.js";
export {
  INVOCATION_FORBIDDEN_EVENTS,
  MEMBER_ROLE_PLUGIN_EVENTS,
  MESSAGE_REACTION_PLUGIN_EVENTS,
  PLUGIN_EVENTS,
  isMemberRolePluginEvent,
  isMessageReactionPluginEvent,
  type MemberRolePluginEvent,
  type MessageReactionPluginEvent,
  type PluginEvent,
} from "./events.js";
export {
  buildPluginGatewayEventStdin,
  listPluginsSubscribedToEvent,
  resolveMaxConcurrentInvocations,
  type PluginGatewayEventStdin,
  type PluginEventRoutingCandidate,
} from "./gateway-event-delivery.js";
export {
  PLUGIN_ID_CLASH_ERROR,
  PLUGIN_MANIFEST_FILENAME,
  RESERVED_ENV_KEYS,
  DEFAULT_MAX_CONCURRENT_INVOCATIONS,
  PluginManifestError,
  parsePluginManifest,
  type PluginEnvironmentKey,
  type PluginLifetime,
  type PluginManifest,
} from "./manifest.js";
export {
  DISCORD_INTERACTION_TIME_LIMIT_MS,
  planPluginSlashCommandsForGuild,
  pluginSlashCommandToDiscordPayload,
  parsePluginSlashCommands,
  slashRunTimeLimitMs,
  type PluginSlashCommand,
  type PluginSlashCollision,
  type PluginSlashCommandOption,
  type PluginSlashOptionType,
  type PluginSlashVisibility,
  type PlannedPluginSlashPublish,
} from "./slash-commands.js";
export { resolvePluginsDirectory } from "./paths.js";
export {
  SPACELAB_PLUGINS_DIRECTORY_NAME,
  SPACELAB_ROSTER_PLUGIN_ID,
  resolveShippedSpacelabPluginsSource,
  syncShippedSpacelabPlugin,
  type SyncShippedSpacelabPluginResult,
  type SyncShippedSpacelabPluginOptions,
} from "./shipped-spacelab-sync.js";
export {
  buildSpacelabAdaptRoleRows,
  type SpacelabAdaptRoleRowView,
} from "./spacelab-roster/adapt-role-view.js";
export {
  isLabRosterExportMessage,
  labRosterExportHeaders,
  parseLabRosterMessage,
  rosterStatusIsActive,
} from "./spacelab-roster/parse.js";
export type {
  ParsedRosterRow,
  ParseLabRosterResult,
  SavedRosterRow,
  SpacelabRememberedMember,
  SpacelabReconcileFailure,
  SpacelabReconcilePassMode,
} from "./spacelab-roster/types.js";
export {
  runReconcilePass,
  buildManagedLinkedRoleIds,
  desiredLinkedRoleIdsForValues,
  exactUsernameMatches,
  MAX_CONSECUTIVE_DISCORD_ERRORS,
  MAX_RECONCILE_MEMBER_ATTEMPTS,
  type DiscordRoleApi,
  type ReconcilePassInput,
  type ReconcilePassResult,
} from "./spacelab-roster/reconcile-pass.js";
export {
  createMaiaDiscordRoleApi,
  fetchSpacelabReconcileState,
  saveSpacelabReconcileState,
  type MaiaPluginClientConfig,
} from "./spacelab-roster/maia-discord-role-api.js";
export { runSpacelabGuildReconcile } from "./spacelab-roster/run-spacelab-reconcile.js";
export {
  SYNTHETIC_LAB_ROSTER_EXPORT,
  SYNTHETIC_LAB_ROSTER_EXPORT_INVALID_ROW,
} from "./spacelab-roster/fixture.js";
export {
  cronMatchesUtcMinute,
  isValidCronExpression,
  utcMinuteStart,
} from "./cron.js";
export { dueCronTargets, type PluginCronTarget } from "./cron-schedule.js";
export {
  buildAlwaysOnGuildConfigStdin,
  buildAlwaysOnPluginProcessEnvironment,
  buildCronInvocationStdin,
  buildInvocationStdin,
  buildManualInvocationStdin,
  buildPluginProcessEnvironment,
  canEnableGuildPlugin,
  guildHasRequiredEnvValues,
  shouldDisableAfterValueChange,
  MAIA_PLUGIN_TOKEN_ENV,
  MAIA_PLUGIN_URL_ENV,
  type AlwaysOnGuildConfigChange,
  type AlwaysOnGuildConfigStdin,
  type GuildPluginValueMap,
  type CronInvocationStdin,
  type ManualInvocationStdin,
  type PluginRunTrigger,
  buildSlashInvocationStdin,
  buildAlwaysOnSlashStdin,
  type SlashInvocationStdin,
  type AlwaysOnSlashStdin,
  type SlashOptionValue,
  type SlashMemberRef,
} from "./guild-config.js";
export {
  spawnSupervisedPluginProcess,
  type SpawnSupervisedPluginProcessInput,
  type SupervisedPluginProcessHandle,
} from "./supervised-process.js";
export {
  runPluginProcess,
  type ProcessLogSink,
  type RunPluginProcessInput,
  type RunPluginProcessResult,
} from "./process-runner.js";
