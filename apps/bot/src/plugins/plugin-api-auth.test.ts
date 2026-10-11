import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pluginAuditActor, readBearerToken } from "./plugin-api-auth.js";

describe("plugin API auth helpers", () => {
  it("builds a plugin moderation actor for audit rows", () => {
    assert.deepEqual(pluginAuditActor("role-sync"), {
      source: "plugin",
      id: "role-sync",
    });
  });

  it("reads bearer tokens from Authorization headers", () => {
    assert.equal(readBearerToken("Bearer secret"), "secret");
    assert.equal(readBearerToken(undefined), null);
  });
});
