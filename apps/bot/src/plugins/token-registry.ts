import { randomBytes } from "node:crypto";

export type PluginTokenKind = "invocation" | "always-on";

export interface RegisteredPluginToken {
  token: string;
  guildId: string | null;
  pluginId: string;
  kind: PluginTokenKind;
}

const TOKEN_PREFIX = "mplg_";

export class PluginTokenRegistry {
  private readonly byToken = new Map<string, RegisteredPluginToken>();

  mintInvocationToken(guildId: string, pluginId: string): string {
    const token = `${TOKEN_PREFIX}${randomBytes(24).toString("base64url")}`;
    this.byToken.set(token, {
      token,
      guildId,
      pluginId,
      kind: "invocation",
    });
    return token;
  }

  mintAlwaysOnToken(pluginId: string): string {
    this.revokeAlwaysOnTokensForPlugin(pluginId);
    const token = `${TOKEN_PREFIX}${randomBytes(24).toString("base64url")}`;
    this.byToken.set(token, {
      token,
      guildId: null,
      pluginId,
      kind: "always-on",
    });
    return token;
  }

  revokeAlwaysOnTokensForPlugin(pluginId: string) {
    for (const [token, entry] of this.byToken) {
      if (entry.kind === "always-on" && entry.pluginId === pluginId) {
        this.byToken.delete(token);
      }
    }
  }

  revoke(token: string) {
    this.byToken.delete(token);
  }

  lookup(token: string): RegisteredPluginToken | null {
    return this.byToken.get(token) ?? null;
  }

  assertGuildAccess(token: string, guildId: string): RegisteredPluginToken | null {
    const entry = this.lookup(token);
    if (!entry) {
      return null;
    }
    if (entry.kind === "invocation") {
      return entry.guildId === guildId ? entry : null;
    }
    return entry.pluginId.length > 0 ? entry : null;
  }
}
