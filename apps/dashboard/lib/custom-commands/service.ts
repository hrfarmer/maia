import {
  validateSlashCommandDescription,
  validateSlashCommandName,
  validateSlashCommandResponse,
} from "@maia/discord";
import {
  createGuildCustomCommand,
  deleteGuildCustomCommand,
  getGuildCustomCommandById,
  getDb,
  recordAuditLog,
  updateGuildCustomCommand,
  type CustomCommandRecord,
} from "@maia/db";
import { syncGuildCustomCommandsToDiscord } from "./sync";
import {
  CustomCommandValidationError,
  parseCustomCommandEphemeral,
} from "./validation";

export { CustomCommandValidationError } from "./validation";

export class CustomCommandNotFoundError extends Error {
  constructor() {
    super("Custom command not found");
    this.name = "CustomCommandNotFoundError";
  }
}

export class CustomCommandConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomCommandConflictError";
  }
}

interface Actor {
  id: string;
  label?: string;
}

function validateFields(input: {
  name?: string;
  description?: string;
  responseText?: string;
}) {
  let name: string | undefined;
  let description: string | undefined;
  let responseText: string | undefined;

  if (input.name !== undefined) {
    const parsed = validateSlashCommandName(input.name);
    if (!parsed.ok) {
      throw new CustomCommandValidationError(parsed.error);
    }
    name = parsed.name;
  }
  if (input.description !== undefined) {
    const parsed = validateSlashCommandDescription(input.description);
    if (!parsed.ok) {
      throw new CustomCommandValidationError(parsed.error);
    }
    description = parsed.description;
  }
  if (input.responseText !== undefined) {
    const parsed = validateSlashCommandResponse(input.responseText);
    if (!parsed.ok) {
      throw new CustomCommandValidationError(parsed.error);
    }
    responseText = parsed.responseText;
  }

  return { name, description, responseText };
}

async function auditCommand(
  guildId: string,
  actor: Actor,
  action: "custom_command.create" | "custom_command.update" | "custom_command.delete",
  targetId: string,
  detail: Record<string, unknown>,
  success: boolean,
  errorMessage?: string,
) {
  const db = getDb();
  await recordAuditLog(db, {
    guildId,
    source: "dashboard",
    actorId: actor.id,
    actorLabel: actor.label,
    action,
    targetType: "custom_command",
    targetId,
    detail,
    success,
    errorMessage,
  });
}

export async function createCustomCommandForGuild(
  guildId: string,
  actor: Actor,
  input: {
    name: string;
    description: string;
    responseText: string;
    ephemeral?: boolean;
  },
): Promise<{ command: CustomCommandRecord; sync: Awaited<ReturnType<typeof syncGuildCustomCommandsToDiscord>> }> {
  const fields = validateFields(input);
  if (!fields.name || !fields.description || !fields.responseText) {
    throw new CustomCommandValidationError("Invalid command fields");
  }
  const ephemeral = parseCustomCommandEphemeral(input.ephemeral);

  const db = getDb();
  let command: CustomCommandRecord;
  try {
    command = await createGuildCustomCommand(db, guildId, {
      name: fields.name,
      description: fields.description,
      responseText: fields.responseText,
      ephemeral,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("unique") || message.includes("duplicate")) {
      throw new CustomCommandConflictError(
        `A custom command named /${fields.name} already exists in this server.`,
      );
    }
    throw error;
  }

  const sync = await syncGuildCustomCommandsToDiscord(guildId);
  await auditCommand(
    guildId,
    actor,
    "custom_command.create",
    command.id,
    { name: command.name },
    sync.ok,
    sync.error,
  );
  return { command, sync };
}

export async function updateCustomCommandForGuild(
  guildId: string,
  commandId: string,
  actor: Actor,
  input: {
    name?: string;
    description?: string;
    responseText?: string;
    enabled?: boolean;
    ephemeral?: boolean;
  },
): Promise<{ command: CustomCommandRecord; sync: Awaited<ReturnType<typeof syncGuildCustomCommandsToDiscord>> }> {
  const db = getDb();
  const existing = await getGuildCustomCommandById(db, guildId, commandId);
  if (!existing) {
    throw new CustomCommandNotFoundError();
  }

  const fields = validateFields(input);
  const ephemeral = parseCustomCommandEphemeral(input.ephemeral);
  let command: CustomCommandRecord | null;
  try {
    command = await updateGuildCustomCommand(db, guildId, commandId, {
      ...fields,
      enabled: input.enabled,
      ephemeral,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("unique") || message.includes("duplicate")) {
      throw new CustomCommandConflictError(
        fields.name
          ? `A custom command named /${fields.name} already exists in this server.`
          : "Command name already exists in this server.",
      );
    }
    throw error;
  }
  if (!command) {
    throw new CustomCommandNotFoundError();
  }

  const sync = await syncGuildCustomCommandsToDiscord(guildId);
  await auditCommand(
    guildId,
    actor,
    "custom_command.update",
    command.id,
    {
      name: command.name,
      enabled: command.enabled,
      ephemeral: command.ephemeral,
      fields: Object.keys(input),
    },
    sync.ok,
    sync.error,
  );
  return { command, sync };
}

export async function deleteCustomCommandForGuild(
  guildId: string,
  commandId: string,
  actor: Actor,
): Promise<{ sync: Awaited<ReturnType<typeof syncGuildCustomCommandsToDiscord>> }> {
  const db = getDb();
  const existing = await getGuildCustomCommandById(db, guildId, commandId);
  if (!existing) {
    throw new CustomCommandNotFoundError();
  }

  const removed = await deleteGuildCustomCommand(db, guildId, commandId);
  if (!removed) {
    throw new CustomCommandNotFoundError();
  }

  const sync = await syncGuildCustomCommandsToDiscord(guildId);
  await auditCommand(
    guildId,
    actor,
    "custom_command.delete",
    commandId,
    { name: existing.name },
    sync.ok,
    sync.error,
  );
  return { sync };
}
