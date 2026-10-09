import Link from "next/link";
import { auth } from "@/auth";
import { AppShell } from "@/components/AppShell";
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
      <div className="section-head">
        <h2>Servers</h2>
        <p>{servers.length}</p>
      </div>
      {servers.length === 0 ? (
        <div className="panel empty">No servers with Manage Server permission.</div>
      ) : (
        <ul className="server-list">
          {servers.map((server) => (
            <li key={server.id} className="server-row">
              {server.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={server.iconUrl}
                  alt=""
                  className="guild-icon"
                  width={44}
                  height={44}
                />
              ) : (
                <div className="guild-icon guild-icon-fallback" aria-hidden>
                  {server.name.slice(0, 1)}
                </div>
              )}
              <div>
                <div className="guild-name">{server.name}</div>
                {server.maiaPresent ? (
                  <Link href={`/servers/${server.id}`} className="ghost-link">
                    Open
                  </Link>
                ) : null}
              </div>
              <span
                className={`status ${server.maiaPresent ? "status-live" : "status-off"}`}
              >
                {server.maiaPresent ? "In server" : "Not added"}
              </span>
              {server.maiaPresent ? (
                <Link href={`/servers/${server.id}`} className="btn btn-secondary">
                  Manage
                </Link>
              ) : (
                <a
                  href={botInviteUrl(server.id)}
                  className="btn btn-primary"
                  target="_blank"
                  rel="noreferrer"
                >
                  Add Maia
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
