import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function NotFound() {
  return (
    <AppShell>
      <div className="panel empty">
        Not found.{" "}
        <Link href="/servers" className="ghost-link">
          Back to servers
        </Link>
      </div>
    </AppShell>
  );
}
