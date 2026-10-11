import type { IncomingMessage } from "node:http";
import type { ModerationActor } from "@maia/moderation";

export function readBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export function pluginAuditActor(pluginId: string): ModerationActor {
  return { source: "plugin", id: pluginId };
}

export async function readJsonBody(
  req: IncomingMessage,
): Promise<unknown | undefined> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) {
    return undefined;
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (raw.length === 0) {
    return undefined;
  }
  return JSON.parse(raw) as unknown;
}

export function isDiscordSnowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value);
}
