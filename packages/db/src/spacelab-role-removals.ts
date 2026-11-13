import { and, eq } from "drizzle-orm";
import type { SpacelabRoleRemoval } from "@maia/plugins";
import type { Db } from "./client.js";
import {
  spacelabRememberedMembers,
  spacelabRoleRemovalFlags,
  spacelabRoleRemovalIgnores,
} from "./schema.js";

export type SpacelabRoleRemovalIgnoreDuration = "week" | "forever";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface SpacelabRoleRemovalFlag {
  discordUserId: string;
  discordHandle: string;
  roleIds: string[];
  flaggedAt: Date;
}

export function spacelabIgnoreUntil(
  duration: SpacelabRoleRemovalIgnoreDuration,
  now: Date,
): Date | null {
  return duration === "week" ? new Date(now.getTime() + WEEK_MS) : null;
}

export function spacelabIgnoreIsActive(
  ignoredUntil: Date | null,
  now: Date,
): boolean {
  return ignoredUntil === null || ignoredUntil.getTime() > now.getTime();
}

export async function applySpacelabRoleRemovals(
  db: Db,
  guildId: string,
  removals: SpacelabRoleRemoval[],
  now: Date = new Date(),
) {
  if (removals.length === 0) {
    return;
  }
  const ignores = await db.query.spacelabRoleRemovalIgnores.findMany({
    where: eq(spacelabRoleRemovalIgnores.guildId, guildId),
  });
  const ignoredUserIds = new Set(
    ignores
      .filter((row) => spacelabIgnoreIsActive(row.ignoredUntil, now))
      .map((row) => row.discordUserId),
  );
  for (const removal of removals) {
    if (removal.roleIds.length === 0 || ignoredUserIds.has(removal.discordUserId)) {
      await deleteSpacelabRoleRemovalFlag(db, guildId, removal.discordUserId);
      continue;
    }
    await db
      .insert(spacelabRoleRemovalFlags)
      .values({
        guildId,
        discordUserId: removal.discordUserId,
        discordHandle: removal.discordHandle,
        roleIdsJson: JSON.stringify(removal.roleIds),
        flaggedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          spacelabRoleRemovalFlags.guildId,
          spacelabRoleRemovalFlags.discordUserId,
        ],
        set: {
          discordHandle: removal.discordHandle,
          roleIdsJson: JSON.stringify(removal.roleIds),
        },
      });
  }
}

function toFlag(
  row: typeof spacelabRoleRemovalFlags.$inferSelect,
): SpacelabRoleRemovalFlag {
  return {
    discordUserId: row.discordUserId,
    discordHandle: row.discordHandle,
    roleIds: JSON.parse(row.roleIdsJson) as string[],
    flaggedAt: row.flaggedAt,
  };
}

export async function listSpacelabRoleRemovalFlags(
  db: Db,
  guildId: string,
): Promise<SpacelabRoleRemovalFlag[]> {
  const rows = await db.query.spacelabRoleRemovalFlags.findMany({
    where: eq(spacelabRoleRemovalFlags.guildId, guildId),
  });
  return rows
    .map(toFlag)
    .sort((a, b) => a.discordHandle.localeCompare(b.discordHandle));
}

export async function getSpacelabRoleRemovalFlag(
  db: Db,
  guildId: string,
  discordUserId: string,
): Promise<SpacelabRoleRemovalFlag | null> {
  const row = await db.query.spacelabRoleRemovalFlags.findFirst({
    where: and(
      eq(spacelabRoleRemovalFlags.guildId, guildId),
      eq(spacelabRoleRemovalFlags.discordUserId, discordUserId),
    ),
  });
  return row ? toFlag(row) : null;
}

async function deleteSpacelabRoleRemovalFlag(
  db: Db,
  guildId: string,
  discordUserId: string,
) {
  await db
    .delete(spacelabRoleRemovalFlags)
    .where(
      and(
        eq(spacelabRoleRemovalFlags.guildId, guildId),
        eq(spacelabRoleRemovalFlags.discordUserId, discordUserId),
      ),
    );
}

export async function completeSpacelabRoleRemoval(
  db: Db,
  guildId: string,
  discordUserId: string,
  removedRoleIds: string[],
) {
  const remembered = await db.query.spacelabRememberedMembers.findFirst({
    where: and(
      eq(spacelabRememberedMembers.guildId, guildId),
      eq(spacelabRememberedMembers.discordUserId, discordUserId),
    ),
  });
  if (remembered) {
    const removed = new Set(removedRoleIds);
    const granted = (JSON.parse(remembered.grantedRoleIdsJson) as string[]).filter(
      (roleId) => !removed.has(roleId),
    );
    await db
      .update(spacelabRememberedMembers)
      .set({ grantedRoleIdsJson: JSON.stringify(granted) })
      .where(
        and(
          eq(spacelabRememberedMembers.guildId, guildId),
          eq(spacelabRememberedMembers.discordUserId, discordUserId),
        ),
      );
  }
  await deleteSpacelabRoleRemovalFlag(db, guildId, discordUserId);
}

export async function ignoreSpacelabRoleRemoval(
  db: Db,
  guildId: string,
  flag: Pick<SpacelabRoleRemovalFlag, "discordUserId" | "discordHandle">,
  duration: SpacelabRoleRemovalIgnoreDuration,
  now: Date = new Date(),
) {
  const ignoredUntil = spacelabIgnoreUntil(duration, now);
  await db
    .insert(spacelabRoleRemovalIgnores)
    .values({
      guildId,
      discordUserId: flag.discordUserId,
      discordHandle: flag.discordHandle,
      ignoredUntil,
    })
    .onConflictDoUpdate({
      target: [
        spacelabRoleRemovalIgnores.guildId,
        spacelabRoleRemovalIgnores.discordUserId,
      ],
      set: { discordHandle: flag.discordHandle, ignoredUntil },
    });
  await deleteSpacelabRoleRemovalFlag(db, guildId, flag.discordUserId);
}
