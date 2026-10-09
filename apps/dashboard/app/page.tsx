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
      <section className="hero">
        <h1>Maia</h1>
        <DiscordLoginButton />
      </section>
    </AppShell>
  );
}
