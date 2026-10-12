import {
  SYNTHETIC_LAB_ROSTER_EXPORT,
  buildSpacelabAdaptRoleRows,
  parseLabRosterMessage,
} from "@maia/plugins";
import { devRoles } from "@/lib/dev-fixtures";
import type { SpacelabAdaptRolesView } from "@/lib/plugins/spacelab-adapt-roles-service";

const devState = {
  adaptValues: [] as string[],
  links: new Map<string, string>(),
  generalMemberRoleId: null as string | null,
  parsedAt: null as string | null,
};

function seedDevSpacelabRosterIfEmpty() {
  if (devState.adaptValues.length > 0) {
    return;
  }
  const parsed = parseLabRosterMessage(SYNTHETIC_LAB_ROSTER_EXPORT, "Subteam");
  if (!parsed.ok) {
    return;
  }
  devState.adaptValues = parsed.adaptRoleValues;
  devState.parsedAt = "2026-10-11T12:00:00.000Z";
}

export function getDevSpacelabAdaptRolesView(): SpacelabAdaptRolesView {
  seedDevSpacelabRosterIfEmpty();
  const guildRoleIds = new Set(devRoles.map((role) => role.id));
  return {
    adaptRoleRows: buildSpacelabAdaptRoleRows({
      currentAdaptValues: devState.adaptValues,
      linkedRoles: devState.links,
      guildRoleIds,
    }),
    guildRoles: devRoles.map((role) => ({ id: role.id, name: role.name })),
    parsedAt: devState.parsedAt,
    generalMemberRoleId: devState.generalMemberRoleId,
    generalMemberRoleMissing: Boolean(
      devState.generalMemberRoleId &&
        !guildRoleIds.has(devState.generalMemberRoleId),
    ),
    forceSync: {
      pending: false,
      requestedAt: null,
      completedAt: null,
      ok: null,
      error: null,
    },
  };
}

export function patchDevSpacelabGeneralMemberRoleId(
  generalMemberRoleId: string | null,
) {
  devState.generalMemberRoleId = generalMemberRoleId;
}

export function patchDevSpacelabAdaptRoleLinks(
  links: Record<string, string | null>,
) {
  seedDevSpacelabRosterIfEmpty();
  for (const [adaptValue, roleId] of Object.entries(links)) {
    if (roleId === null) {
      devState.links.delete(adaptValue);
      continue;
    }
    devState.links.set(adaptValue, roleId);
  }
}

export function ingestDevSpacelabRosterMessage(message: string) {
  const parsed = parseLabRosterMessage(message, "Subteam");
  if (!parsed.ok) {
    return { ok: false as const };
  }
  devState.adaptValues = parsed.adaptRoleValues;
  devState.parsedAt = new Date().toISOString();
  return { ok: true as const };
}
