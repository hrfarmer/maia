import {
  createMaiaDiscordRoleApi,
  fetchSpacelabReconcileState,
  saveSpacelabReconcileState,
  type MaiaPluginClientConfig,
} from "./maia-discord-role-api.js";
import { runReconcilePass } from "./reconcile-pass.js";
import type { SpacelabReconcilePassMode } from "./types.js";

async function reportForceSyncOutcome(
  config: MaiaPluginClientConfig,
  outcome: { ok: boolean; error?: string | null },
) {
  const fetchImpl = config.fetchImpl ?? fetch;
  await fetchImpl(
    `${config.pluginUrl}/v1/guilds/${encodeURIComponent(config.guildId)}/spacelab-roster/force-sync-outcome`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${config.pluginToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(outcome),
    },
  );
}

export async function runSpacelabGuildReconcile(
  config: MaiaPluginClientConfig,
  mode: SpacelabReconcilePassMode = { kind: "full" },
) {
  const state = await fetchSpacelabReconcileState(config);
  if (!state) {
    if (mode.kind === "force-sync") {
      await reportForceSyncOutcome(config, {
        ok: false,
        error: "no_roster",
      }).catch(() => undefined);
    }
    return { ok: false as const, reason: "no_roster" as const };
  }
  const api = createMaiaDiscordRoleApi(config);
  const guildRoleIds = await api.listGuildRoleIds();
  const result = await runReconcilePass(
    {
      rows: state.rows,
      rememberedMembers: state.rememberedMembers,
      links: new Map(Object.entries(state.links)),
      generalMemberRoleId: state.generalMemberRoleId ?? null,
      previousAppliedLinks: new Map(
        Object.entries(state.previousAppliedLinks ?? {}),
      ),
      previousAppliedGeneralMemberRoleId:
        state.previousAppliedGeneralMemberRoleId ?? null,
      guildRoleIds,
      failures: state.failures,
      mode,
    },
    api,
  );
  await saveSpacelabReconcileState(config, {
    rows: result.rows,
    links: state.links,
    rememberedMembers: result.rememberedMembers,
    failures: result.failures,
    forceSyncCompleted:
      mode.kind === "force-sync"
        ? {
            ok: !result.stoppedEarly,
            error: result.stoppedEarly ? "stopped_early" : null,
          }
        : undefined,
  });
  return { ok: true as const, stoppedEarly: result.stoppedEarly };
}

export async function runSpacelabGuildForceSync(
  config: MaiaPluginClientConfig,
) {
  try {
    return await runSpacelabGuildReconcile(config, { kind: "force-sync" });
  } catch (error) {
    await reportForceSyncOutcome(config, {
      ok: false,
      error: error instanceof Error ? error.message : "force_sync_failed",
    }).catch(() => undefined);
    throw error;
  }
}
