export interface SpacelabCycleStatusPayload {
  lastCycleAt: string | null;
  lastError: string | null;
  pendingMembers: Array<{ discordHandle: string }>;
  exhaustedMembers: Array<{ discordHandle: string }>;
}

export function formatSpacelabLastCycleLabel(lastCycleAt: string | null): string {
  return lastCycleAt ? new Date(lastCycleAt).toLocaleString() : "Never";
}

export function formatSpacelabLastErrorLabel(lastError: string | null): string {
  return lastError ?? "None";
}

export function spacelabCycleMemberLists(status: SpacelabCycleStatusPayload) {
  return {
    pendingHandles: status.pendingMembers.map((member) => member.discordHandle),
    exhaustedHandles: status.exhaustedMembers.map(
      (member) => member.discordHandle,
    ),
  };
}
