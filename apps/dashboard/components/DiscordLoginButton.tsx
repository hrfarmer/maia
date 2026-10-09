import { signIn } from "@/auth";

export function DiscordLoginButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("discord", { redirectTo: "/servers" });
      }}
    >
      <button type="submit" className="btn btn-primary">
        Continue with Discord
      </button>
    </form>
  );
}
