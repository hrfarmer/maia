export class CustomCommandValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomCommandValidationError";
  }
}

export function parseCustomCommandEphemeral(
  value: unknown,
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new CustomCommandValidationError("ephemeral must be a boolean");
  }
  return value;
}
