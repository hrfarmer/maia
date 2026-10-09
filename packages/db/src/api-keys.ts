import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "./client.js";
import { guildApiKeys } from "./schema.js";

const KEY_PREFIX = "maia_";

function hashApiKey(rawKey: string, pepper: string): string {
  return createHash("sha256").update(`${pepper}:${rawKey}`).digest("hex");
}

export function getApiKeyPepper(): string {
  const pepper =
    process.env.MAIA_API_KEY_PEPPER ?? process.env.AUTH_SECRET ?? "";
  if (!pepper) {
    throw new Error("MAIA_API_KEY_PEPPER or AUTH_SECRET is required for API keys");
  }
  return pepper;
}

export interface CreatedApiKey {
  id: string;
  guildId: string;
  name: string;
  rawKey: string;
  createdAt: Date;
}

export async function createGuildApiKey(
  db: Db,
  guildId: string,
  name: string,
): Promise<CreatedApiKey> {
  const id = crypto.randomUUID();
  const rawKey = `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  const keyHash = hashApiKey(rawKey, getApiKeyPepper());

  const [row] = await db
    .insert(guildApiKeys)
    .values({
      id,
      guildId,
      name: name.trim(),
      keyHash,
    })
    .returning();

  return {
    id: row.id,
    guildId: row.guildId,
    name: row.name,
    rawKey,
    createdAt: row.createdAt,
  };
}

export async function listGuildApiKeys(db: Db, guildId: string) {
  return db.query.guildApiKeys.findMany({
    where: and(eq(guildApiKeys.guildId, guildId), isNull(guildApiKeys.revokedAt)),
    columns: {
      id: true,
      name: true,
      createdAt: true,
      lastUsedAt: true,
    },
    orderBy: (keys, { desc }) => [desc(keys.createdAt)],
  });
}

export async function revokeGuildApiKey(
  db: Db,
  guildId: string,
  keyId: string,
): Promise<boolean> {
  const result = await db
    .update(guildApiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(guildApiKeys.id, keyId),
        eq(guildApiKeys.guildId, guildId),
        isNull(guildApiKeys.revokedAt),
      ),
    )
    .returning({ id: guildApiKeys.id });
  return result.length > 0;
}

export interface ValidatedApiKey {
  id: string;
  guildId: string;
  name: string;
}

export async function validateApiKey(
  db: Db,
  rawKey: string,
): Promise<ValidatedApiKey | null> {
  if (!rawKey.startsWith(KEY_PREFIX)) {
    return null;
  }
  const keyHash = hashApiKey(rawKey, getApiKeyPepper());
  const row = await db.query.guildApiKeys.findFirst({
    where: and(eq(guildApiKeys.keyHash, keyHash), isNull(guildApiKeys.revokedAt)),
  });
  if (!row) {
    return null;
  }

  await db
    .update(guildApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(guildApiKeys.id, row.id));

  return {
    id: row.id,
    guildId: row.guildId,
    name: row.name,
  };
}
