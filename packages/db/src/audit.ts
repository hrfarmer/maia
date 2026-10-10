import { desc, eq } from "drizzle-orm";
import type { Db } from "./client.js";
import {
  type AuditAction,
  type AuditSource,
  type AuditTargetType,
  auditLogs,
} from "./schema.js";

export interface AuditEntryInput {
  guildId: string;
  source: AuditSource;
  actorId: string;
  actorLabel?: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  detail?: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
}

export async function recordAuditLog(db: Db, input: AuditEntryInput) {
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    guildId: input.guildId,
    source: input.source,
    actorId: input.actorId,
    actorLabel: input.actorLabel ?? null,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    detail: input.detail ? JSON.stringify(input.detail) : null,
    success: input.success,
    errorMessage: input.errorMessage ?? null,
  });
}

export async function listAuditLogs(
  db: Db,
  guildId: string,
  limit = 50,
) {
  return db.query.auditLogs.findMany({
    where: eq(auditLogs.guildId, guildId),
    orderBy: [desc(auditLogs.createdAt)],
    limit,
  });
}
