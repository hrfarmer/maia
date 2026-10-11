import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PluginTokenRegistry } from "./token-registry.js";

describe("PluginTokenRegistry", () => {
  it("scopes invocation tokens to one guild", () => {
    const registry = new PluginTokenRegistry();
    const token = registry.mintInvocationToken("111", "demo");
    assert.ok(registry.assertGuildAccess(token, "111"));
    assert.equal(registry.assertGuildAccess(token, "222"), null);
    registry.revoke(token);
    assert.equal(registry.lookup(token), null);
  });
});
