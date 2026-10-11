import { NextResponse } from "next/server";
import { Permission } from "@maia/discord";
import { getDb, getLatestPluginScan } from "@maia/db";
import { DEV_GUILD_ID, devHelpersEnabled, devPluginScan } from "@/lib/dev-fixtures";
import { requireSessionGuildAccess } from "@/lib/session-auth";

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

function serializeScan(scan: Awaited<ReturnType<typeof getLatestPluginScan>>) {
  if (!scan) {
    return null;
  }
  return {
    id: scan.id,
    startedAt: scan.startedAt.toISOString(),
    completedAt: scan.completedAt?.toISOString() ?? null,
    trigger: scan.trigger,
    scanError: scan.scanError,
    plugins: scan.plugins.map((plugin) => ({
      id: plugin.id,
      directoryName: plugin.directoryName,
      status: plugin.status,
      pluginId: plugin.pluginId,
      name: plugin.name,
      version: plugin.version,
      errorMessage: plugin.errorMessage,
    })),
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const { guildId } = await context.params;
  const access = await requireSessionGuildAccess(
    guildId,
    Permission.ManageGuild,
    "Manage Server",
  );
  if ("error" in access) {
    return access.error;
  }

  if (devHelpersEnabled() && guildId === DEV_GUILD_ID) {
    return NextResponse.json({ scan: devPluginScan });
  }

  const db = getDb();
  const scan = await getLatestPluginScan(db);
  return NextResponse.json({ scan: serializeScan(scan) });
}
