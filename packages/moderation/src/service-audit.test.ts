import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { searchGuildMembersForModeration } from "./service.js";

describe("searchGuildMembersForModeration", () => {
  it("returns no members when the query is empty", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("Discord should not be called without a query");
    };
    try {
      const members = await searchGuildMembersForModeration("guild", "   ");
      assert.deepEqual(members, []);
    } finally {
      globalThis.fetch = original;
    }
  });
});
