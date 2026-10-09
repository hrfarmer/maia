import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/AppShell";
import { DiscordLoginButton } from "@/components/DiscordLoginButton";

export default async function HomePage() {
  const session = await auth();
  if (session) {
    redirect("/servers");
  }

  return (
    <AppShell showNav={false}>
      <div className="flex max-w-sm flex-col gap-8 pt-12 md:pt-20">
        <h1 className="text-4xl font-semibold tracking-tight">Maia</h1>
        <DiscordLoginButton />
      </div>
    </AppShell>
  );
}
