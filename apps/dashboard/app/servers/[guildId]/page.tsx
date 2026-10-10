import Link from "next/link";
import { notFound } from "next/navigation";
import { DEFAULT_COMMANDS, getDb, getGuildWithCommands } from "@maia/db";
import { auth } from "@/auth";
import { AppShell } from "@/components/AppShell";
import { GuildAvatar } from "@/components/GuildAvatar";
import { ServerManagePanel } from "@/components/ServerManagePanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  botInviteUrl,
  fetchUserGuilds,
  filterManageableGuilds,
  guildIconUrl,
} from "@/lib/discord";
import { DEV_GUILD_ID } from "@/lib/dev-fixtures";

interface PageProps {
  params: Promise<{ guildId: string }>;
}

export default async function ServerDetailPage({ params }: PageProps) {
  const { guildId } = await params;
  const session = await auth();
  if (!session?.accessToken) {
    return null;
  }

  const manageable = filterManageableGuilds(
    await fetchUserGuilds(session.accessToken),
  );
  const guild = manageable.find((item) => item.id === guildId);
  if (!guild) {
    notFound();
  }

  const devSession =
    process.env.MAIA_ENABLE_DEV_HELPERS === "1" &&
    session.accessToken === "dev-access-token";

  let maiaPresent = false;
  let commands: string[] = [...DEFAULT_COMMANDS];

  if (devSession && guildId === DEV_GUILD_ID) {
    maiaPresent = true;
  } else {
    try {
      const db = getDb();
      const record = await getGuildWithCommands(db, guildId);
      maiaPresent = !!record && !record.leftAt;
      commands =
        record?.guildCommands
          ?.filter((row) => row.enabled)
          .map((row) => row.commandName) ?? [...DEFAULT_COMMANDS];
    } catch {
      if (!devSession) {
        throw new Error("Database unavailable");
      }
    }
  }

  const icon = guildIconUrl(guild, 80);

  return (
    <AppShell>
      <Button variant="ghost" size="sm" className="-ml-2 mb-6 w-fit" asChild>
        <Link href="/servers">← Servers</Link>
      </Button>

      <div className="mb-8 flex items-center gap-4">
        <GuildAvatar
          name={guild.name}
          iconUrl={icon}
          className="size-14 rounded-sm"
        />
        <h1 className="text-2xl font-semibold tracking-tight">{guild.name}</h1>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Commands</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table data-testid="command-list">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Command</TableHead>
                <TableHead className="pr-6 text-right">Enabled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commands.map((name) => (
                <TableRow key={name}>
                  <TableCell className="pl-6 font-mono text-sm">/{name}</TableCell>
                  <TableCell className="pr-6 text-right text-muted-foreground">
                    Yes
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!maiaPresent ? (
        <div className="mt-6">
          <Button asChild>
            <a href={botInviteUrl(guildId)} target="_blank" rel="noreferrer">
              Add Maia
            </a>
          </Button>
        </div>
      ) : (
        <div className="mt-6">
          <ServerManagePanel guildId={guildId} />
        </div>
      )}
    </AppShell>
  );
}
