export interface GraphMailboxMessage {
  id: string;
  receivedDateTime: string;
  bodyContent: string;
}

export interface GraphMailboxClient {
  listInboxMessages(accessToken: string): Promise<GraphMailboxMessage[]>;
  moveMessageToArchive(accessToken: string, messageId: string): Promise<void>;
}

export function resolveGraphBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = env.MAIA_GRAPH_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return "https://graph.microsoft.com/v1.0";
}

export function createGraphMailboxClient(input: {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}): GraphMailboxClient {
  const fetchImpl = input.fetchImpl ?? fetch;
  const baseUrl = input.baseUrl.replace(/\/$/, "");
  let archiveFolderId: string | null = null;

  async function resolveArchiveFolderId(accessToken: string): Promise<string> {
    if (archiveFolderId) {
      return archiveFolderId;
    }
    const response = await fetchImpl(`${baseUrl}/me/mailFolders/Archive`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`graph_archive_folder_failed:${response.status}`);
    }
    const body = (await response.json()) as { id?: string };
    if (!body.id) {
      throw new Error("graph_archive_folder_missing_id");
    }
    archiveFolderId = body.id;
    return archiveFolderId;
  }

  return {
    async listInboxMessages(accessToken) {
      const response = await fetchImpl(
        `${baseUrl}/me/mailFolders/inbox/messages?$select=id,receivedDateTime,body&$top=100`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Prefer: 'outlook.body-content-type="text"',
          },
        },
      );
      if (!response.ok) {
        throw new Error(`graph_list_inbox_failed:${response.status}`);
      }
      const body = (await response.json()) as {
        value?: Array<{
          id?: string;
          receivedDateTime?: string;
          body?: { content?: string };
        }>;
      };
      return (body.value ?? [])
        .filter((item) => item.id && item.receivedDateTime)
        .map((item) => ({
          id: item.id!,
          receivedDateTime: item.receivedDateTime!,
          bodyContent: item.body?.content ?? "",
        }));
    },
    async moveMessageToArchive(accessToken, messageId) {
      const destinationId = await resolveArchiveFolderId(accessToken);
      const response = await fetchImpl(
        `${baseUrl}/me/messages/${encodeURIComponent(messageId)}/move`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ destinationId }),
        },
      );
      if (!response.ok) {
        throw new Error(`graph_move_to_archive_failed:${response.status}`);
      }
    },
  };
}
