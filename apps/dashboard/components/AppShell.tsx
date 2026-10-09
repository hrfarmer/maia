import Link from "next/link";
import { signOut } from "@/auth";

interface AppShellProps {
  children: React.ReactNode;
  showNav?: boolean;
}

export function AppShell({ children, showNav = true }: AppShellProps) {
  return (
    <div className="page">
      <div className="shell">
        <header className="topbar">
          <Link href={showNav ? "/servers" : "/"} className="logo">
            Ma<span>ia</span>
          </Link>
          {showNav ? (
            <div className="topbar-actions">
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button type="submit" className="ghost-link">
                  Sign out
                </button>
              </form>
            </div>
          ) : null}
        </header>
        {children}
      </div>
    </div>
  );
}
