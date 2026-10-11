export interface PendingSlashReply {
  guildId: string;
  pluginId: string;
  commandName: string;
  memberId: string;
  ephemeral: boolean;
  replySent: boolean;
  editReply: (content: string) => Promise<void>;
}

export class SlashReplyRegistry {
  private readonly byToken = new Map<string, PendingSlashReply>();

  register(token: string, entry: PendingSlashReply) {
    this.byToken.set(token, entry);
  }

  get(token: string): PendingSlashReply | null {
    return this.byToken.get(token) ?? null;
  }

  remove(token: string) {
    this.byToken.delete(token);
  }
}

export const SLASH_FAILURE_MESSAGE = "The plugin did not send a reply in time.";
