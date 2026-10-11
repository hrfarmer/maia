import type { SpacelabCycleStatusPayload } from "@/lib/plugins/spacelab-cycle-display";

export function getDevSpacelabCycleStatus(): SpacelabCycleStatusPayload {
  return {
    lastCycleAt: new Date("2026-01-15T12:00:00.000Z").toISOString(),
    lastError: null,
    pendingMembers: [{ discordHandle: "user.retry" }],
    exhaustedMembers: [{ discordHandle: "user.exhausted" }],
  };
}
