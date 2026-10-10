import { recordAuditLog, type AuditAction, type Db } from "@maia/db";

export async function logCommandAudit(
  db: Db,
  input: {
    guildId: string;
    actorId: string;
    actorLabel: string;
    action: AuditAction;
    targetType: "member" | "role" | "ban";
    targetId: string;
    detail?: Record<string, unknown>;
    success: boolean;
    errorMessage?: string;
  },
) {
  await recordAuditLog(db, {
    guildId: input.guildId,
    source: "command",
    actorId: input.actorId,
    actorLabel: input.actorLabel,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    detail: input.detail,
    success: input.success,
    errorMessage: input.errorMessage,
  });
}
