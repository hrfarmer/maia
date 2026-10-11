import { Permission } from "@maia/discord";
import { getDb } from "@maia/db";
import { jsonError } from "@/lib/api/http";
import { disconnectOutlookMailbox } from "@/lib/microsoft/outlook-mailbox";
import { requireSessionGuildAccess } from "@/lib/session-auth";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ guildId: string }> },
) {
  const { guildId } = await context.params;
  const access = await requireSessionGuildAccess(
    guildId,
    Permission.ManageGuild,
    "Manage Server",
  );
  if ("error" in access) {
    return access.error;
  }

  const db = getDb();
  await disconnectOutlookMailbox(db, guildId);
  return Response.json({ ok: true });
}
