/** Built-in Maia slash command names (registered globally). */
export const DEFAULT_COMMAND_NAMES = ["hello", "role", "member"] as const;

export type BuiltinCommandName = (typeof DEFAULT_COMMAND_NAMES)[number];
