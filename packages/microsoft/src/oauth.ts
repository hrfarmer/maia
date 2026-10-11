import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { MICROSOFT_OAUTH_SCOPES } from "./constants.js";
import type { MicrosoftOAuthConfig } from "./config.js";

export interface MicrosoftOAuthStatePayload {
  guildId: string;
  pluginId: string;
  exp: number;
  nonce: string;
}

const STATE_TTL_MS = 15 * 60 * 1000;

function signStatePayload(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

export function createMicrosoftOAuthState(
  input: { guildId: string; pluginId: string },
  authSecret: string,
): string {
  const payload: MicrosoftOAuthStatePayload = {
    guildId: input.guildId,
    pluginId: input.pluginId,
    exp: Date.now() + STATE_TTL_MS,
    nonce: randomBytes(16).toString("base64url"),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const sig = signStatePayload(payloadB64, authSecret);
  return `${payloadB64}.${sig}`;
}

export function parseMicrosoftOAuthState(
  state: string,
  authSecret: string,
): MicrosoftOAuthStatePayload {
  const [payloadB64, sig] = state.split(".");
  if (!payloadB64 || !sig) {
    throw new Error("Invalid OAuth state");
  }
  const expected = signStatePayload(payloadB64, authSecret);
  const sigBuf = Buffer.from(sig, "base64url");
  const expectedBuf = Buffer.from(expected, "base64url");
  if (
    sigBuf.length !== expectedBuf.length ||
    !timingSafeEqual(sigBuf, expectedBuf)
  ) {
    throw new Error("Invalid OAuth state signature");
  }
  const payload = JSON.parse(
    Buffer.from(payloadB64, "base64url").toString("utf8"),
  ) as MicrosoftOAuthStatePayload;
  if (payload.exp < Date.now()) {
    throw new Error("OAuth state expired");
  }
  if (!payload.guildId || !payload.pluginId) {
    throw new Error("Invalid OAuth state payload");
  }
  return payload;
}

export function buildMicrosoftAuthorizeUrl(
  config: MicrosoftOAuthConfig,
  state: string,
): string {
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", MICROSOFT_OAUTH_SCOPES.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

export interface MicrosoftTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export async function exchangeMicrosoftAuthorizationCode(
  config: MicrosoftOAuthConfig,
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MicrosoftTokenResponse> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  });
  const response = await fetchImpl(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Microsoft token exchange failed: ${response.status} ${text}`);
  }
  return (await response.json()) as MicrosoftTokenResponse;
}
