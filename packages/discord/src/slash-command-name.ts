import { DEFAULT_COMMAND_NAMES } from "./builtin-commands.js";

/** Discord application command name rules (chat input). */
const SLASH_COMMAND_NAME_PATTERN = /^[\da-z_-]{1,32}$/;

export const SLASH_COMMAND_DESCRIPTION_MAX = 100;
export const SLASH_COMMAND_RESPONSE_MAX = 2000;

export interface SlashCommandNameValidation {
  ok: true;
  name: string;
}

export interface SlashCommandNameError {
  ok: false;
  error: string;
}

export type SlashCommandNameResult =
  | SlashCommandNameValidation
  | SlashCommandNameError;

export function normalizeSlashCommandName(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateSlashCommandName(
  raw: string,
  options?: { reservedNames?: readonly string[] },
): SlashCommandNameResult {
  const name = normalizeSlashCommandName(raw);
  if (!name) {
    return { ok: false, error: "Name is required." };
  }
  if (!SLASH_COMMAND_NAME_PATTERN.test(name)) {
    return {
      ok: false,
      error:
        "Name must be 1–32 characters and use lowercase letters, numbers, hyphens, or underscores.",
    };
  }
  const reserved = options?.reservedNames ?? DEFAULT_COMMAND_NAMES;
  if (reserved.includes(name)) {
    return {
      ok: false,
      error: `Name conflicts with the built-in /${name} command.`,
    };
  }
  return { ok: true, name };
}

export function validateSlashCommandDescription(raw: string): {
  ok: true;
  description: string;
} | { ok: false; error: string } {
  const description = raw.trim();
  if (!description) {
    return { ok: false, error: "Description is required." };
  }
  if (description.length > SLASH_COMMAND_DESCRIPTION_MAX) {
    return {
      ok: false,
      error: `Description must be at most ${SLASH_COMMAND_DESCRIPTION_MAX} characters.`,
    };
  }
  return { ok: true, description };
}

export function validateSlashCommandResponse(raw: string): {
  ok: true;
  responseText: string;
} | { ok: false; error: string } {
  const responseText = raw;
  if (!responseText.trim()) {
    return { ok: false, error: "Response text is required." };
  }
  if (responseText.length > SLASH_COMMAND_RESPONSE_MAX) {
    return {
      ok: false,
      error: `Response must be at most ${SLASH_COMMAND_RESPONSE_MAX} characters.`,
    };
  }
  return { ok: true, responseText };
}
