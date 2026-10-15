import type { GraphMailboxClient, GraphMailboxMessage } from "./graph-mailbox.js";
import { GraphMoveMessageError } from "./graph-mailbox.js";

export class FakeGraphMailbox implements GraphMailboxClient {
  inbox: GraphMailboxMessage[] = [];
  archived: string[] = [];
  failArchiveFor = new Set<string>();
  notFoundArchiveFor = new Set<string>();

  async listInboxMessages(_accessToken: string): Promise<GraphMailboxMessage[]> {
    return [...this.inbox];
  }

  async moveMessageToArchive(
    _accessToken: string,
    messageId: string,
  ): Promise<void> {
    if (this.notFoundArchiveFor.has(messageId)) {
      throw new GraphMoveMessageError(404);
    }
    if (this.failArchiveFor.has(messageId)) {
      throw new GraphMoveMessageError(503);
    }
    const index = this.inbox.findIndex((message) => message.id === messageId);
    if (index >= 0) {
      this.inbox.splice(index, 1);
    }
    this.archived.push(messageId);
  }
}
