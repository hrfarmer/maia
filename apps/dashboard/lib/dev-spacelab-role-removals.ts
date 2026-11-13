import { devRoles } from "@/lib/dev-fixtures";
import {
  buildSpacelabRoleRemovalsView,
  type SpacelabRoleRemovalFlagInput,
  type SpacelabRoleRemovalsView,
} from "@/lib/plugins/spacelab-role-removals-view";

let devFlags: SpacelabRoleRemovalFlagInput[] = [
  {
    discordUserId: "444444444444444444",
    discordHandle: "jordan",
    roleIds: ["222222222222222222"],
    flaggedAt: new Date("2026-01-15T12:00:00.000Z"),
  },
];

export function getDevSpacelabRoleRemovalsView(): SpacelabRoleRemovalsView {
  return buildSpacelabRoleRemovalsView(devFlags, devRoles);
}

export function resolveDevSpacelabRoleRemoval(discordUserId: string): boolean {
  const before = devFlags.length;
  devFlags = devFlags.filter((flag) => flag.discordUserId !== discordUserId);
  return devFlags.length !== before;
}
