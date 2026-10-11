import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SLASH_FAILURE_MESSAGE } from "./slash-reply-registry.js";

describe("slash reply registry", () => {
  it("uses a fixed failure message for missing replies", () => {
    assert.match(SLASH_FAILURE_MESSAGE, /reply/i);
  });
});
