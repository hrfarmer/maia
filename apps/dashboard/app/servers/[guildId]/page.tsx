import Link from "next/link";
import { notFound } from "next/navigation";
import { DEFAULT_COMMANDS, getDb, getGuildWithCommands } from "@maia/db";
import { auth } from "@/auth";
import { AppShell } from "@/components/AppShell";
import {
  botInviteUrl,
  fetchUserGuilds,
  filterManageableGuilds,
  guildIconUrl,
} from "@/lib/discord";

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

  const db = getDb();
  const record = await getGuildWithCommands(db, guildId);
  const maiaPresent = !!record && !record.leftAt;

  const commands =
    record?.guildCommands?.filter((row) => row.enabled).map((row) => row.commandName) ??
    [...DEFAULT_COMMANDS];

  const icon = guildIconUrl(guild, 80);

  return (
    <AppShell>
      <Link href="/servers" className="back-link">
        ← Servers
      </Link>
      <div className="server-header">
        {icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={icon} alt="" className="guild-icon" width={56} height={56} />
        ) : (
          <div className="guild-icon guild-icon-fallback" aria-hidden>
            {guild.name.slice(0, 1)}
          </div>
        )}
        <h1>{guild.name}</h1>
      </div>

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <h3>Commands</h3>
        <ul className="command-list">
          {commands.map((name) => (
            <li key={name} className="command-item">
              <span className="command-name">/{name}</span>
              <span className="command-state">On</span>
            </li>
          ))}
        </ul>
      </div>

      {!maiaPresent ? (
        <a
          href={botInviteUrl(guildId)}
          className="btn btn-primary"
          target="_blank"
          rel="noreferrer"
        >
          Add Maia
        </a>
      ) : null}
    </AppShell>
  );
}
