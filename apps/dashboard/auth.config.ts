import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const isProtected =
        path.startsWith("/servers") || path.startsWith("/api/servers");
      if (isProtected) {
        return !!auth;
      }
      return true;
    },
    async jwt({ token, account }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.accessToken && typeof token.accessToken === "string") {
        session.accessToken = token.accessToken;
      }
      return session;
    },
  },
  providers: [],
  trustHost: true,
} satisfies NextAuthConfig;
