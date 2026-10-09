import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      // Discord RFC 9207: callback includes iss=https://discord.com (see discord.com/.well-known/oauth-authorization-server)
      issuer: "https://discord.com",
      authorization: {
        params: {
          scope: "identify guilds",
        },
      },
    }),
  ],
});
