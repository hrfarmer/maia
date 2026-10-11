import type { AuditEntryInput } from "@maia/db";

export function buildPluginRunAuditEntry(input: {
  guildId: string;
  pluginId: string;
  trigger: "run_now" | "cron" | "slash";
  memberId?: string;
  commandName?: string;
  success: boolean;
  errorMessage?: string;
}): AuditEntryInput {
  const detail: Record<string, unknown> = { trigger: input.trigger };
  if (input.trigger === "slash") {
    if (input.memberId) {
      detail.memberId = input.memberId;
    }
    if (input.commandName) {
      detail.command = input.commandName;
    }
  }
  return {
    guildId: input.guildId,
    source: "plugin",
    actorId: input.pluginId,
    action: "plugin.run",
    targetType: "plugin",
    targetId: input.pluginId,
    detail,
    success: input.success,
    errorMessage: input.errorMessage,
  };
}

export function formatPluginLogLine(pluginId: string, stream: "stdout" | "stderr", chunk: string) {
  const prefix =
    stream === "stderr" ? `[plugin:${pluginId}:stderr]` : `[plugin:${pluginId}]`;
  return `${prefix} ${chunk}`.replace(/\n$/, "");
}
