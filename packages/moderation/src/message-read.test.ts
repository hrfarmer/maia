import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMessageListQuery } from "./message-read.js";

describe("parseMessageListQuery", () => {
  it("defaults limit to 50", () => {
    const parsed = parseMessageListQuery(new URLSearchParams());
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.value.limit, 50);
    }
  });

  it("rejects limits above 100", () => {
    const parsed = parseMessageListQuery(new URLSearchParams({ limit: "101" }));
    assert.equal(parsed.ok, false);
  });
});
