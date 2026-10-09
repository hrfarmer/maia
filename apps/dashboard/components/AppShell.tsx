import Link from "next/link";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface AppShellProps {
  children: React.ReactNode;
  showNav?: boolean;
}

export function AppShell({ children, showNav = true }: AppShellProps) {
  return (
    <div className="flex min-h-svh flex-col">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 md:px-6">
        <header className="flex items-center justify-between gap-4 pb-6">
          <Link
            href={showNav ? "/servers" : "/"}
            className="text-lg font-semibold tracking-tight"
          >
            Maia
          </Link>
          {showNav ? (
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          ) : null}
        </header>
        <Separator className="mb-8" />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
