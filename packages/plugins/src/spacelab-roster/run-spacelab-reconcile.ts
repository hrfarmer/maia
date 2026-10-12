import {
  createMaiaDiscordRoleApi,
  fetchSpacelabReconcileState,
  saveSpacelabReconcileState,
  type MaiaPluginClientConfig,
} from "./maia-discord-role-api.js";
import { runReconcilePass } from "./reconcile-pass.js";
import type { SpacelabReconcilePassMode } from "./types.js";

export async function runSpacelabGuildReconcile(
  config: MaiaPluginClientConfig,
  mode: SpacelabReconcilePassMode = { kind: "full" },
) {
  const state = await fetchSpacelabReconcileState(config);
  if (!state) {
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
  });
  return { ok: true as const, stoppedEarly: result.stoppedEarly };
}
