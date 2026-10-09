import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";

export async function POST() {
  if (process.env.MAIA_ENABLE_DEV_HELPERS !== "1") {
    return NextResponse.json({ error: "Disabled" }, { status: 404 });
  }

  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "AUTH_SECRET not set" }, { status: 500 });
  }

  const token = await encode({
    token: {
      sub: "dev-user",
      name: "Dev User",
      accessToken: "dev-access-token",
    },
    secret,
    salt: "authjs.session-token",
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set("authjs.session-token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: false,
  });
  return response;
}
