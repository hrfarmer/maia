import { NextResponse } from "next/server";
import { getDb, validateApiKey } from "@maia/db";
import { checkRateLimit } from "../rate-limit";
import { ModerationError } from "../moderation/hierarchy";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

import {
  apiKeyAuditActor,
  apiKeyMatchesGuild,
  parseBearerAuth,
} from "./auth-utils";

export {
  apiKeyAuditActor,
  apiKeyMatchesGuild,
  parseBearerAuth,
} from "./auth-utils";

export async function authenticateApiKey(
  request: Request,
  guildId: string,
) {
  const rawKey = parseBearerAuth(request.headers.get("authorization"));
  if (!rawKey) {
    return { error: jsonError("Missing or invalid Authorization header", 401) };
  }

  const limit = checkRateLimit(`api:${rawKey.slice(0, 16)}`);
  if (!limit.ok) {
    return {
      error: NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSec) },
        },
      ),
    };
  }

  const db = getDb();
  const key = await validateApiKey(db, rawKey);
  if (!key) {
    return { error: jsonError("Invalid API key", 401) };
  }
  if (!apiKeyMatchesGuild(key.guildId, guildId)) {
    return { error: jsonError("API key is not valid for this guild", 403) };
  }

  return { actor: apiKeyAuditActor(key) };
}

export function handleModerationError(error: unknown) {
  if (error instanceof ModerationError) {
    return jsonError(error.message, 400);
  }
  if (error instanceof Error) {
    return jsonError(error.message, 500);
  }
  return jsonError("Unexpected error", 500);
}
