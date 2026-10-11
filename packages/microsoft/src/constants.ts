/** Space Lab roster plugin id (Outlook mailbox connection is scoped to this plugin). */
export const SPACELAB_ROSTER_PLUGIN_ID = "spacelab-roster";

export const MICROSOFT_CONSUMERS_AUTHORITY =
  "https://login.microsoftonline.com/consumers/oauth2/v2.0";

export const MICROSOFT_OAUTH_SCOPES = ["Mail.ReadWrite", "offline_access"] as const;

export const MICROSOFT_OAUTH_CALLBACK_PATH = "/api/oauth/microsoft/callback";

export function microsoftOAuthRedirectUri(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, "");
  return `${trimmed}${MICROSOFT_OAUTH_CALLBACK_PATH}`;
}
