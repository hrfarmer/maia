export function getDashboardBaseUrl(): string {
  const url =
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXTAUTH_URL ??
    "";
  if (!url) {
    throw new Error("AUTH_URL or NEXT_PUBLIC_BASE_URL is required");
  }
  return url.replace(/\/$/, "");
}
