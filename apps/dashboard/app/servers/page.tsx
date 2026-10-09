import Link from "next/link";
import { auth } from "@/auth";
import { AppShell } from "@/components/AppShell";
import { GuildAvatar } from "@/components/GuildAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { botInviteUrl } from "@/lib/discord";
import { getManagedServersForUser } from "@/lib/servers";

export default async function ServersPage() {
  const session = await auth();
  if (!session?.accessToken) {
    return null;
  }

  const servers = await getManagedServersForUser(session.accessToken);

  return (
    <AppShell>
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Servers</h1>
        <span className="text-sm tabular-nums text-muted-foreground">
          {servers.length}
        </span>
      </div>
      {servers.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No servers with Manage Server permission.
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 py-0">
          <Table data-testid="server-list">
            <TableHeader>
              <TableRow>
                <TableHead className="w-14 pl-4"> </TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="pr-4 text-right"> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {servers.map((server) => (
                <TableRow key={server.id}>
                  <TableCell className="pl-4">
                    <GuildAvatar name={server.name} iconUrl={server.iconUrl} />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{server.name}</div>
                    <div className="mt-1 sm:hidden">
                      <Badge variant={server.maiaPresent ? "secondary" : "outline"}>
                        {server.maiaPresent ? "In server" : "Not added"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={server.maiaPresent ? "secondary" : "outline"}>
                      {server.maiaPresent ? "In server" : "Not added"}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    {server.maiaPresent ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/servers/${server.id}`}>Manage</Link>
                      </Button>
                    ) : (
                      <Button size="sm" asChild>
                        <a
                          href={botInviteUrl(server.id)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Add Maia
                        </a>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </AppShell>
  );
}
