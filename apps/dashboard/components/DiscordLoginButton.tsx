import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export function DiscordLoginButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("discord", { redirectTo: "/servers" });
      }}
    >
      <Button type="submit" size="lg">
        Continue with Discord
      </Button>
    </form>
  );
}
