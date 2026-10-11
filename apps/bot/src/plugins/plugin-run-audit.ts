import type { AuditEntryInput } from "@maia/db";

export function buildPluginRunAuditEntry(input: {
  guildId: string;
  pluginId: string;
  trigger: "run_now" | "cron";
  success: boolean;
  errorMessage?: string;
}): AuditEntryInput {
  return {
    guildId: input.guildId,
    source: "plugin",
    actorId: input.pluginId,
    action: "plugin.run",
    targetType: "plugin",
    targetId: input.pluginId,
    detail: { trigger: input.trigger },
    success: input.success,
    errorMessage: input.errorMessage,
  };
}

export function formatPluginLogLine(pluginId: string, stream: "stdout" | "stderr", chunk: string) {
  const prefix =
    stream === "stderr" ? `[plugin:${pluginId}:stderr]` : `[plugin:${pluginId}]`;
  return `${prefix} ${chunk}`.replace(/\n$/, "");
}
