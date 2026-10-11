import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPluginApiServer } from "./plugin-api-server.js";
import { PluginTokenRegistry } from "./token-registry.js";

describe("plugin localhost API", () => {
  it("accepts a token only for its guild and binds to loopback", async () => {
    const registry = new PluginTokenRegistry();
    const token = registry.mintInvocationToken("guild-a", "demo");
    const api = createPluginApiServer({
      port: 0,
      tokenRegistry: registry,
    });
    await api.listen();
    const address = api.server.address();
    assert.ok(address && typeof address === "object");
    assert.equal(address.address, "127.0.0.1");

    const ok = await fetch(`${api.url()}/v1/guilds/guild-a/ping`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(ok.status, 200);

    const wrongGuild = await fetch(`${api.url()}/v1/guilds/guild-b/ping`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(wrongGuild.status, 403);

    await api.close();
  });
});
