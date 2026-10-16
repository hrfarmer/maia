import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMemberJoinGatewayPayload } from "./member-join-gateway.js";

describe("parseMemberJoinGatewayPayload", () => {
  it("reads user id and username from a serialized guild member", () => {
    assert.deepEqual(
      parseMemberJoinGatewayPayload({
        user: { id: "123", username: "Lab.User" },
      }),
      { discordUserId: "123", username: "Lab.User" },
    );
  });

  it("accepts a flat payload with id and username", () => {
    assert.deepEqual(parseMemberJoinGatewayPayload({ id: "9", username: "x" }), {
      discordUserId: "9",
      username: "x",
    });
  });

  it("returns null when required fields are missing", () => {
    assert.equal(parseMemberJoinGatewayPayload(null), null);
    assert.equal(parseMemberJoinGatewayPayload({ user: { id: "1" } }), null);
  });
});
