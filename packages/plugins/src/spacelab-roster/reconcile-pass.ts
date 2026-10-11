import { rosterStatusIsActive } from "./parse.js";
import type {
  SavedRosterRow,
  SpacelabRememberedMember,
  SpacelabReconcileFailure,
  SpacelabReconcilePassMode,
} from "./types.js";

export const MAX_RECONCILE_MEMBER_ATTEMPTS = 5;
export const MAX_CONSECUTIVE_DISCORD_ERRORS = 3;

export interface DiscordRoleApi {
  listGuildRoleIds(): Promise<Set<string>>;
  searchMembersByHandle(handle: string): Promise<Array<{ id: string; username: string }>>;
  getMemberRoleIds(userId: string): Promise<string[]>;
  addRole(userId: string, roleId: string): Promise<void>;
  removeRole(userId: string, roleId: string): Promise<void>;
}

export interface ReconcilePassInput {
  rows: SavedRosterRow[];
  rememberedMembers: SpacelabRememberedMember[];
  links: Map<string, string>;
  guildRoleIds: Set<string>;
  failures: SpacelabReconcileFailure[];
  mode: SpacelabReconcilePassMode;
}

export interface ReconcilePassResult {
  rows: SavedRosterRow[];
  rememberedMembers: SpacelabRememberedMember[];
  failures: SpacelabReconcileFailure[];
  stoppedEarly: boolean;
}

export function buildManagedLinkedRoleIds(
  links: Map<string, string>,
  guildRoleIds: Set<string>,
): Set<string> {
  const managed = new Set<string>();
  for (const roleId of links.values()) {
    if (guildRoleIds.has(roleId)) {
      managed.add(roleId);
    }
  }
  return managed;
}

export function desiredLinkedRoleIdsForValues(
  adaptRoleValues: string[],
  links: Map<string, string>,
  guildRoleIds: Set<string>,
): Set<string> {
  const desired = new Set<string>();
  for (const value of adaptRoleValues) {
    const roleId = links.get(value);
    if (roleId && guildRoleIds.has(roleId)) {
      desired.add(roleId);
    }
  }
  return desired;
}

export function exactUsernameMatches(
  members: Array<{ id: string; username: string }>,
  discordHandle: string,
): Array<{ id: string; username: string }> {
  return members.filter(
    (member) =>
      member.username.localeCompare(discordHandle, undefined, {
        sensitivity: "accent",
      }) === 0,
  );
}

function failureKeyForMember(
  discordHandle: string,
  storedUserId: string | undefined,
): string {
  return storedUserId ?? discordHandle.toLowerCase();
}

function storedUserIdForHandle(
  discordHandle: string,
  rows: SavedRosterRow[],
  rememberedMembers: SpacelabRememberedMember[],
): string | undefined {
  const row = rows.find(
    (item) =>
      item.discordHandle.toLowerCase() === discordHandle.toLowerCase(),
  );
  if (row?.discordUserId) {
    return row.discordUserId;
  }
  const remembered = rememberedMembers.find(
    (member) =>
      member.discordHandle.toLowerCase() === discordHandle.toLowerCase(),
  );
  return remembered?.discordUserId;
}

function failureMap(failures: SpacelabReconcileFailure[]) {
  return new Map(failures.map((failure) => [failure.memberKey, failure]));
}

function upsertFailure(
  failures: SpacelabReconcileFailure[],
  memberKey: string,
  discordHandle: string,
): SpacelabReconcileFailure[] {
  const existing = failures.find((failure) => failure.memberKey === memberKey);
  if (!existing) {
    return [...failures, { memberKey, discordHandle, attempts: 1 }];
  }
  return failures.map((failure) =>
    failure.memberKey === memberKey
      ? { ...failure, attempts: failure.attempts + 1, discordHandle }
      : failure,
  );
}

function removeFailure(
  failures: SpacelabReconcileFailure[],
  memberKey: string,
): SpacelabReconcileFailure[] {
  return failures.filter((failure) => failure.memberKey !== memberKey);
}

function rememberMember(
  remembered: SpacelabRememberedMember[],
  discordUserId: string,
  discordHandle: string,
): SpacelabRememberedMember[] {
  const without = remembered.filter(
    (member) => member.discordUserId !== discordUserId,
  );
  return [...without, { discordUserId, discordHandle }];
}

interface WorkItem {
  discordHandle: string;
  discordUserId?: string;
  rosterRow?: SavedRosterRow;
  desiredLinkedRoleIds: Set<string>;
  memberKey: string;
}

function buildWorkItems(input: ReconcilePassInput): WorkItem[] {
  const rosterByHandle = new Map<string, SavedRosterRow>();
  for (const row of input.rows) {
    rosterByHandle.set(row.discordHandle.toLowerCase(), row);
  }
  const rememberedByUserId = new Map(
    input.rememberedMembers.map((member) => [member.discordUserId, member]),
  );
  const failures = failureMap(input.failures);
  const items: WorkItem[] = [];
  const seen = new Set<string>();

  const shouldInclude = (memberKey: string) => {
    const failure = failures.get(memberKey);
    if (failure && failure.attempts >= MAX_RECONCILE_MEMBER_ATTEMPTS) {
      return false;
    }
    if (input.mode.kind === "retry-failures-only") {
      return Boolean(failure);
    }
    return true;
  };

  const pushItem = (item: WorkItem) => {
    if (seen.has(item.memberKey)) {
      return;
    }
    if (!shouldInclude(item.memberKey)) {
      return;
    }
    seen.add(item.memberKey);
    items.push(item);
  };

  for (const row of [...input.rows].sort((a, b) =>
    a.discordHandle.localeCompare(b.discordHandle),
  )) {
    const remembered = [...rememberedByUserId.values()].find(
      (member) =>
        member.discordHandle.toLowerCase() === row.discordHandle.toLowerCase(),
    );
    const discordUserId = row.discordUserId ?? remembered?.discordUserId;
    const memberKey = failureKeyForMember(
      row.discordHandle,
      storedUserIdForHandle(row.discordHandle, input.rows, input.rememberedMembers),
    );
    const active = rosterStatusIsActive(row.status);
    const hasValues = row.adaptRoleValues.length > 0;
    const isRemembered =
      Boolean(discordUserId && rememberedByUserId.has(discordUserId)) ||
      Boolean(remembered);

    if (active && hasValues) {
      pushItem({
        discordHandle: row.discordHandle,
        discordUserId,
        rosterRow: row,
        desiredLinkedRoleIds: desiredLinkedRoleIdsForValues(
          row.adaptRoleValues,
          input.links,
          input.guildRoleIds,
        ),
        memberKey,
      });
      continue;
    }

    if (isRemembered && ( !active || !hasValues)) {
      pushItem({
        discordHandle: row.discordHandle,
        discordUserId,
        rosterRow: row,
        desiredLinkedRoleIds: new Set(),
        memberKey,
      });
    }
  }

  for (const remembered of [...input.rememberedMembers].sort((a, b) =>
    a.discordHandle.localeCompare(b.discordHandle),
  )) {
    if (rosterByHandle.has(remembered.discordHandle.toLowerCase())) {
      continue;
    }
    const memberKey = failureKeyForMember(
      remembered.discordHandle,
      storedUserIdForHandle(
        remembered.discordHandle,
        input.rows,
        input.rememberedMembers,
      ),
    );
    pushItem({
      discordHandle: remembered.discordHandle,
      discordUserId: remembered.discordUserId,
      desiredLinkedRoleIds: new Set(),
      memberKey,
    });
  }

  return items;
}

function isDiscordError(error: unknown): boolean {
  return error instanceof Error;
}

export async function runReconcilePass(
  input: ReconcilePassInput,
  api: DiscordRoleApi,
): Promise<ReconcilePassResult> {
  const guildRoleIds =
    input.guildRoleIds.size > 0
      ? input.guildRoleIds
      : await api.listGuildRoleIds();
  const managedRoleIds = buildManagedLinkedRoleIds(input.links, guildRoleIds);
  const workItems = buildWorkItems({ ...input, guildRoleIds });

  let rows = input.rows.map((row) => ({ ...row }));
  let rememberedMembers = [...input.rememberedMembers];
  let failures = [...input.failures];
  let consecutiveDiscordErrors = 0;
  let stoppedEarly = false;

  const updateRowUserId = (handle: string, userId: string) => {
    rows = rows.map((row) =>
      row.discordHandle.toLowerCase() === handle.toLowerCase()
        ? { ...row, discordUserId: userId }
        : row,
    );
  };

  for (const item of workItems) {
    if (consecutiveDiscordErrors >= MAX_CONSECUTIVE_DISCORD_ERRORS) {
      stoppedEarly = true;
      break;
    }

    const storedUserId = storedUserIdForHandle(
      item.discordHandle,
      rows,
      rememberedMembers,
    );
    let userId = item.discordUserId ?? storedUserId;
    if (!userId) {
      const searchResults = await api.searchMembersByHandle(item.discordHandle);
      const matches = exactUsernameMatches(searchResults, item.discordHandle);
      if (matches.length !== 1) {
        continue;
      }
      userId = matches[0]!.id;
    }

    const failureKey = failureKeyForMember(item.discordHandle, storedUserId);
    const handleFailureKey = item.discordHandle.toLowerCase();

    try {
      const currentRoleIds = await api.getMemberRoleIds(userId);
      const currentManaged = currentRoleIds.filter((roleId) =>
        managedRoleIds.has(roleId),
      );
      const desired = item.desiredLinkedRoleIds;
      const toAdd = [...desired].filter(
        (roleId) => !currentManaged.includes(roleId),
      );
      const toRemove = currentManaged.filter((roleId) => !desired.has(roleId));

      for (const roleId of toAdd) {
        await api.addRole(userId, roleId);
      }
      for (const roleId of toRemove) {
        await api.removeRole(userId, roleId);
      }

      consecutiveDiscordErrors = 0;
      updateRowUserId(item.discordHandle, userId);
      rememberedMembers = rememberMember(
        rememberedMembers,
        userId,
        item.discordHandle,
      );
      failures = removeFailure(failures, failureKey);
      failures = removeFailure(failures, handleFailureKey);
    } catch (error) {
      if (!isDiscordError(error)) {
        throw error;
      }
      consecutiveDiscordErrors += 1;
      let nextFailures = failures;
      if (handleFailureKey !== failureKey) {
        nextFailures = removeFailure(nextFailures, handleFailureKey);
      }
      failures = upsertFailure(nextFailures, failureKey, item.discordHandle);
      if (userId && rememberedMembers.some((member) => member.discordUserId === userId)) {
        // keep remembered entry as-is
      }
    }
  }

  return {
    rows,
    rememberedMembers,
    failures,
    stoppedEarly,
  };
}
