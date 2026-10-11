import {
  MICROSOFT_CONSUMERS_AUTHORITY,
  microsoftOAuthRedirectUri,
} from "./constants.js";

export interface MicrosoftOAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  redirectUri: string;
}

export function resolveMicrosoftOAuthConfig(baseUrl: string): MicrosoftOAuthConfig {
  const clientId = process.env.MICROSOFT_CLIENT_ID ?? "";
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET ?? "";
  if (!clientId || !clientSecret) {
    throw new Error("MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET are required");
  }
  const authority =
    process.env.MICROSOFT_OAUTH_AUTHORITY ?? MICROSOFT_CONSUMERS_AUTHORITY;
  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI ?? microsoftOAuthRedirectUri(baseUrl);
  return {
    clientId,
    clientSecret,
    authorizeUrl: `${authority}/authorize`,
    tokenUrl: process.env.MICROSOFT_TOKEN_URL ?? `${authority}/token`,
    redirectUri,
  };
}
