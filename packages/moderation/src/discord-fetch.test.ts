import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

describe("discordFetch rate limits", () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.DISCORD_TOKEN;

  beforeEach(() => {
    process.env.DISCORD_TOKEN = "test-token";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) {
      delete process.env.DISCORD_TOKEN;
    } else {
      process.env.DISCORD_TOKEN = originalToken;
    }
    mock.restoreAll();
  });

  it("retries on 429 using retry_after then succeeds", async () => {
    let calls = 0;
    globalThis.fetch = mock.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(
          JSON.stringify({
            message: "You are being rate limited.",
            retry_after: 0.001,
          }),
          { status: 429, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ id: "bot-user" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const { discordFetch } = await import("./discord-bot.js");
    const result = await discordFetch<{ id: string }>("/users/@me");
    assert.equal(result.id, "bot-user");
    assert.equal(calls, 2);
  });
});
