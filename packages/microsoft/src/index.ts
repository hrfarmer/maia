export {
  MICROSOFT_CONSUMERS_AUTHORITY,
  MICROSOFT_OAUTH_CALLBACK_PATH,
  MICROSOFT_OAUTH_SCOPES,
  SPACELAB_ROSTER_PLUGIN_ID,
  microsoftOAuthRedirectUri,
} from "./constants.js";
export { resolveMicrosoftOAuthConfig, type MicrosoftOAuthConfig } from "./config.js";
export {
  buildMicrosoftAuthorizeUrl,
  createMicrosoftOAuthState,
  exchangeMicrosoftAuthorizationCode,
  parseMicrosoftOAuthState,
  type MicrosoftOAuthStatePayload,
  type MicrosoftTokenResponse,
} from "./oauth.js";
