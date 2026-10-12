import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createGraphMailboxClient } from "./graph-mailbox.js";

describe("createGraphMailboxClient", () => {
  it("requests plain-text message bodies from Microsoft Graph", async () => {
    let preferHeader: string | null = null;
    const client = createGraphMailboxClient({
      baseUrl: "https://graph.example/v1.0",
      fetchImpl: async (input, init) => {
        const url = String(input);
        assert.match(url, /\/me\/mailFolders\/inbox\/messages/);
        preferHeader =
          (init?.headers as Record<string, string> | undefined)?.Prefer ??
          (init?.headers as Headers | undefined)?.get?.("Prefer") ??
          null;
        return new Response(
          JSON.stringify({
            value: [
              {
                id: "msg-1",
                receivedDateTime: "2026-01-01T00:00:00Z",
                body: { content: "DiscordHandle,Status,Subteam\na,Active,{}" },
              },
            ],
          }),
          { status: 200 },
        );
      },
    });

    const messages = await client.listInboxMessages("token");
    assert.equal(preferHeader, 'outlook.body-content-type="text"');
    assert.equal(messages[0]?.bodyContent, "DiscordHandle,Status,Subteam\na,Active,{}");
  });

  it("requests from and sender fields and can filter by from address", async () => {
    let requestUrl = "";
    const client = createGraphMailboxClient({
      baseUrl: "https://graph.example/v1.0",
      fetchImpl: async (input) => {
        requestUrl = String(input);
        return new Response(JSON.stringify({ value: [] }), { status: 200 });
      },
    });

    await client.listInboxMessages("token", {
      fromAddress: "roster@lab.edu",
    });
    assert.match(requestUrl, /\$select=id,receivedDateTime,body,from,sender/);
    assert.match(
      requestUrl,
      /\$filter=from\/emailAddress\/address eq 'roster@lab\.edu'/,
    );
  });
});
