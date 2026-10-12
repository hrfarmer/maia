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
  listGuildMembers(): Promise<Array<{ id: string; username: string }>>;
  getMemberRoleIds(userId: string): Promise<string[]>;
  addRole(userId: string, roleId: string): Promise<void>;
  removeRole(userId: string, roleId: string): Promise<void>;
}

export interface ReconcilePassInput {
  rows: SavedRosterRow[];
  rememberedMembers: SpacelabRememberedMember[];
  links: Map<string, string>;
  generalMemberRoleId?: string | null;
  previousAppliedLinks: Map<string, string>;
  previousAppliedGeneralMemberRoleId?: string | null;
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

export function buildManagedRoleIds(
  links: Map<string, string>,
  guildRoleIds: Set<string>,
  generalMemberRoleId?: string | null,
): Set<string> {
  const managed = buildManagedLinkedRoleIds(links, guildRoleIds);
  if (generalMemberRoleId && guildRoleIds.has(generalMemberRoleId)) {
    managed.add(generalMemberRoleId);
  }
  return managed;
}

export function rowQualifiesForAdaptReconcile(
  row: SavedRosterRow,
  links: Map<string, string>,
  guildRoleIds: Set<string>,
): boolean {
  if (!rosterStatusIsActive(row.status)) {
    return false;
  }
  return (
    desiredLinkedRoleIdsForValues(row.adaptRoleValues, links, guildRoleIds)
      .size > 0
  );
}

export function rowQualifiesForGeneralAdaptMemberRole(
  row: SavedRosterRow,
  links: Map<string, string>,
  guildRoleIds: Set<string>,
): boolean {
  return rowQualifiesForAdaptReconcile(row, links, guildRoleIds);
}

export function computeRoleChangesForMember(input: {
  currentRoleIds: string[];
  desiredRoleIds: Set<string>;
  removableRoleIds: Set<string>;
  forceAdaptValid: boolean;
  adaptLinkedRoleIds: Set<string>;
}): { toAdd: string[]; toRemove: string[] } {
  const desired = input.desiredRoleIds;
  if (input.forceAdaptValid) {
    const toAdd = [...desired].filter(
      (roleId) => !input.currentRoleIds.includes(roleId),
    );
    const toRemove = input.currentRoleIds.filter(
      (roleId) =>
        input.adaptLinkedRoleIds.has(roleId) && !desired.has(roleId),
    );
    return { toAdd, toRemove };
  }
  const maiaOwnedOnMember = input.currentRoleIds.filter((roleId) =>
    input.removableRoleIds.has(roleId),
  );
  const toAdd = [...desired].filter(
    (roleId) => !input.currentRoleIds.includes(roleId),
  );
  const toRemove = maiaOwnedOnMember.filter((roleId) => !desired.has(roleId));
  return { toAdd, toRemove };
}

export function desiredRoleIdsForMember(
  adaptRoleValues: string[],
  links: Map<string, string>,
  guildRoleIds: Set<string>,
  generalMemberRoleId: string | null | undefined,
  qualifiesForGeneralMemberRole: boolean,
): Set<string> {
  const desired = desiredLinkedRoleIdsForValues(
    adaptRoleValues,
    links,
    guildRoleIds,
  );
  if (
    qualifiesForGeneralMemberRole &&
    generalMemberRoleId &&
    guildRoleIds.has(generalMemberRoleId)
  ) {
    desired.add(generalMemberRoleId);
  }
  return desired;
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

export function memberMatchesRosterHandle(
  username: string,
  discordHandle: string,
): boolean {
  const compare = (a: string, b: string) =>
    a.localeCompare(b, undefined, { sensitivity: "accent" }) === 0;
  const handleLower = discordHandle.toLowerCase();
  const userLower = username.toLowerCase();
  if (compare(userLower, handleLower)) {
    return true;
  }
  const hash = discordHandle.indexOf("#");
  if (hash >= 0) {
    return compare(userLower, discordHandle.slice(0, hash).toLowerCase());
  }
  return false;
}

export function exactUsernameMatches(
  members: Array<{ id: string; username: string }>,
  discordHandle: string,
): Array<{ id: string; username: string }> {
  return members.filter((member) =>
    memberMatchesRosterHandle(member.username, discordHandle),
  );
}

export function buildGuildMemberLookupIndex(
  members: Array<{ id: string; username: string }>,
): Map<string, Array<{ id: string; username: string }>> {
  const index = new Map<string, Array<{ id: string; username: string }>>();
  for (const member of members) {
    const key = member.username.toLowerCase();
    const bucket = index.get(key) ?? [];
    bucket.push(member);
    index.set(key, bucket);
  }
  return index;
}

function lookupMembersByRosterHandle(
  index: Map<string, Array<{ id: string; username: string }>>,
  discordHandle: string,
): Array<{ id: string; username: string }> {
  const keys = new Set<string>([discordHandle.toLowerCase()]);
  const hash = discordHandle.indexOf("#");
  if (hash >= 0) {
    keys.add(discordHandle.slice(0, hash).toLowerCase());
  }
  const byId = new Map<string, { id: string; username: string }>();
  for (const key of keys) {
    for (const member of index.get(key) ?? []) {
      byId.set(member.id, member);
    }
  }
  return [...byId.values()];
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
  grantedRoleIds: string[],
): SpacelabRememberedMember[] {
  const without = remembered.filter(
    (member) => member.discordUserId !== discordUserId,
  );
  return [...without, { discordUserId, discordHandle, grantedRoleIds }];
}

export function roleIdsFromLinkMap(links: Map<string, string>): Set<string> {
  return new Set(links.values());
}

export function removableMaiaRoleIdsForMember(
  member: SpacelabRememberedMember | undefined,
  previousAppliedLinkRoleIds: Set<string>,
  previousAppliedGeneralMemberRoleId: string | null | undefined,
): Set<string> {
  const granted = member?.grantedRoleIds ?? [];
  const removable = new Set(granted);
  if (granted.length === 0) {
    for (const roleId of previousAppliedLinkRoleIds) {
      removable.add(roleId);
    }
    if (previousAppliedGeneralMemberRoleId) {
      removable.add(previousAppliedGeneralMemberRoleId);
    }
  }
  return removable;
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
      const qualifiesForGeneral = rowQualifiesForGeneralAdaptMemberRole(
        row,
        input.links,
        input.guildRoleIds,
      );
      pushItem({
        discordHandle: row.discordHandle,
        discordUserId,
        rosterRow: row,
        desiredLinkedRoleIds: desiredRoleIdsForMember(
          row.adaptRoleValues,
          input.links,
          input.guildRoleIds,
          input.generalMemberRoleId,
          qualifiesForGeneral,
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
  const workItems = buildWorkItems({ ...input, guildRoleIds });
  const previousAppliedLinkRoleIds = roleIdsFromLinkMap(
    input.previousAppliedLinks,
  );
  const adaptLinkedRoleIds = buildManagedRoleIds(
    input.links,
    guildRoleIds,
    input.generalMemberRoleId,
  );
  const forceSync = input.mode.kind === "force-sync";

  let memberLookup = new Map<
    string,
    Array<{ id: string; username: string }>
  >();
  let memberListUnavailable = false;
  const needsHandleLookup = workItems.some((item) => {
    const storedUserId = storedUserIdForHandle(
      item.discordHandle,
      input.rows,
      input.rememberedMembers,
    );
    return !(item.discordUserId ?? storedUserId);
  });
  if (needsHandleLookup) {
    try {
      const guildMembers = await api.listGuildMembers();
      memberLookup = buildGuildMemberLookupIndex(guildMembers);
    } catch (error) {
      if (!isDiscordError(error)) {
        throw error;
      }
      memberListUnavailable = true;
    }
  }

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
      if (memberListUnavailable) {
        continue;
      }
      const candidates = lookupMembersByRosterHandle(
        memberLookup,
        item.discordHandle,
      );
      const matches = exactUsernameMatches(candidates, item.discordHandle);
      if (matches.length !== 1) {
        continue;
      }
      userId = matches[0]!.id;
    }

    const failureKey = failureKeyForMember(item.discordHandle, storedUserId);
    const handleFailureKey = item.discordHandle.toLowerCase();

    try {
      const currentRoleIds = await api.getMemberRoleIds(userId);
      const rememberedMember = rememberedMembers.find(
        (member) => member.discordUserId === userId,
      );
      const removableRoleIds = removableMaiaRoleIdsForMember(
        rememberedMember,
        previousAppliedLinkRoleIds,
        input.previousAppliedGeneralMemberRoleId,
      );
      const desired = item.desiredLinkedRoleIds;
      const forceAdaptValid =
        forceSync &&
        item.rosterRow !== undefined &&
        rowQualifiesForAdaptReconcile(
          item.rosterRow,
          input.links,
          guildRoleIds,
        );
      const { toAdd, toRemove } = computeRoleChangesForMember({
        currentRoleIds,
        desiredRoleIds: desired,
        removableRoleIds,
        forceAdaptValid,
        adaptLinkedRoleIds,
      });

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
        [...desired],
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
