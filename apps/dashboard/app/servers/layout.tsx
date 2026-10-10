import { auth } from "@/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { getManagedServersForUser } from "@/lib/servers";

export default async function ServersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.accessToken) {
    return null;
  }

  const servers = await getManagedServersForUser(session.accessToken);

  return (
    <DashboardShell
      servers={servers}
      userName={session.user?.name}
      userImage={session.user?.image}
    >
      {children}
    </DashboardShell>
  );
}
