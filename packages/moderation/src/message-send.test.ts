import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMessageSendInput } from "./message-send.js";

describe("parseMessageSendInput", () => {
  it("accepts plain text content", () => {
    const result = parseMessageSendInput({ content: "Hello guild" });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.content, "Hello guild");
      assert.equal(result.value.replyToMessageId, undefined);
    }
  });

  it("accepts an optional reply target", () => {
    const result = parseMessageSendInput({
      content: "Reply",
      replyToMessageId: "123456789012345678",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.replyToMessageId, "123456789012345678");
    }
  });

  it("rejects empty content", () => {
    const result = parseMessageSendInput({ content: "" });
    assert.equal(result.ok, false);
  });
});
