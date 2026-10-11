export interface DiscordApplicationCommandOptionPayload {
  type: number;
  name: string;
  description: string;
  required?: boolean;
}

/** Discord REST chat-input command shape (subset Maia uses). */
export interface DiscordApplicationCommandPayload {
  type: 1;
  name: string;
  description: string;
  options?: DiscordApplicationCommandOptionPayload[];
  default_member_permissions?: string | null;
}
