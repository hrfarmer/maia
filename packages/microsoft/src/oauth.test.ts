import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveMicrosoftOAuthConfig } from "./config.js";
import {
  buildMicrosoftAuthorizeUrl,
  createMicrosoftOAuthState,
  exchangeMicrosoftAuthorizationCode,
  parseMicrosoftOAuthState,
} from "./oauth.js";

describe("Microsoft OAuth helpers", () => {
  it("builds authorize URL with consumers scopes and redirect", () => {
    process.env.MICROSOFT_CLIENT_ID = "client-id";
    process.env.MICROSOFT_CLIENT_SECRET = "client-secret";
    const config = resolveMicrosoftOAuthConfig("https://maia.aychar.dev");
    const state = createMicrosoftOAuthState(
      { guildId: "111", pluginId: "spacelab-roster" },
      "auth-secret",
    );
    const url = new URL(buildMicrosoftAuthorizeUrl(config, state));
    assert.equal(url.hostname, "login.microsoftonline.com");
    assert.match(url.pathname, /\/consumers\/oauth2\/v2\.0\/authorize$/);
    assert.equal(url.searchParams.get("client_id"), "client-id");
    assert.equal(url.searchParams.get("scope"), "Mail.ReadWrite offline_access");
    assert.equal(
      url.searchParams.get("redirect_uri"),
      "https://maia.aychar.dev/api/oauth/microsoft/callback",
    );
    assert.equal(url.searchParams.get("state"), state);
  });

  it("round-trips signed OAuth state", () => {
    const state = createMicrosoftOAuthState(
      { guildId: "guild-a", pluginId: "spacelab-roster" },
      "signing-secret",
    );
    const parsed = parseMicrosoftOAuthState(state, "signing-secret");
    assert.equal(parsed.guildId, "guild-a");
    assert.equal(parsed.pluginId, "spacelab-roster");
  });

  it("exchanges authorization code via token endpoint", async () => {
    process.env.MICROSOFT_CLIENT_ID = "client-id";
    process.env.MICROSOFT_CLIENT_SECRET = "client-secret";
    process.env.MICROSOFT_TOKEN_URL = "https://fake.microsoft/token";
    const config = resolveMicrosoftOAuthConfig("http://localhost:3000");
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(String(input), "https://fake.microsoft/token");
      const body = String(init?.body ?? "");
      assert.match(body, /grant_type=authorization_code/);
      assert.match(body, /code=test-code/);
      return new Response(
        JSON.stringify({
          access_token: "access",
          refresh_token: "refresh-abc",
          expires_in: 3600,
          token_type: "Bearer",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };
    const tokens = await exchangeMicrosoftAuthorizationCode(
      config,
      "test-code",
      fetchImpl as typeof fetch,
    );
    assert.equal(tokens.refresh_token, "refresh-abc");
  });
});
