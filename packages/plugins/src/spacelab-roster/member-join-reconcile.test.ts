import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runSpacelabGuildMemberJoinReconcile } from "./run-spacelab-reconcile.js";

describe("runSpacelabGuildMemberJoinReconcile", () => {
  it("skips when there is no saved roster", async () => {
    const result = await runSpacelabGuildMemberJoinReconcile(
      {
        pluginUrl: "http://127.0.0.1:1",
        pluginToken: "token",
        guildId: "g1",
        fetchImpl: async () =>
          new Response(JSON.stringify({ ok: false }), { status: 404 }),
      },
      { discordUserId: "u1", username: "user.a" },
    );
    assert.deepEqual(result, { ok: true, skipped: "no_roster" });
  });
});
