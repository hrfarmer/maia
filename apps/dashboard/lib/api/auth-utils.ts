export function apiKeyMatchesGuild(
  keyGuildId: string,
  routeGuildId: string,
): boolean {
  return keyGuildId === routeGuildId;
}

export function parseBearerAuth(header: string | null): string | null {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}
