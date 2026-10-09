export { auth as middleware } from "@/auth";

export const config = {
  matcher: ["/servers/:path*", "/api/servers/:path*"],
};
