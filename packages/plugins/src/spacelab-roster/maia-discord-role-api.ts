import type { DiscordRoleApi } from "./reconcile-pass.js";

export interface MaiaPluginClientConfig {
  pluginUrl: string;
  pluginToken: string;
  guildId: string;
  fetchImpl?: typeof fetch;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function createMaiaDiscordRoleApi(
  config: MaiaPluginClientConfig,
): DiscordRoleApi {
  const fetchImpl = config.fetchImpl ?? fetch;
  const base = `${config.pluginUrl}/v1/guilds/${encodeURIComponent(config.guildId)}`;

  return {
    async listGuildRoleIds() {
      const response = await fetchImpl(`${base}/roles`, {
        headers: authHeaders(config.pluginToken),
      });
      if (!response.ok) {
        throw new Error(`list roles failed: ${response.status}`);
      }
      const body = (await response.json()) as { roles?: Array<{ id: string }> };
      return new Set((body.roles ?? []).map((role) => role.id));
    },
    async searchMembersByHandle(handle) {
      const response = await fetchImpl(
        `${base}/members?query=${encodeURIComponent(handle)}`,
        { headers: authHeaders(config.pluginToken) },
      );
      if (!response.ok) {
        throw new Error(`member search failed: ${response.status}`);
      }
      const body = (await response.json()) as {
        members?: Array<{ user?: { id?: string; username?: string } }>;
      };
      return (body.members ?? [])
        .map((member) => ({
          id: member.user?.id ?? "",
          username: member.user?.username ?? "",
        }))
        .filter((member) => member.id && member.username);
    },
    async getMemberRoleIds(userId) {
      const response = await fetchImpl(`${base}/members/${userId}/roles`, {
        headers: authHeaders(config.pluginToken),
      });
      if (!response.ok) {
        throw new Error(`get member roles failed: ${response.status}`);
      }
      const body = (await response.json()) as { roleIds?: string[] };
      return body.roleIds ?? [];
    },
    async addRole(userId, roleId) {
      const response = await fetchImpl(
        `${base}/members/${userId}/roles/${roleId}`,
        {
          method: "PUT",
          headers: authHeaders(config.pluginToken),
        },
      );
      if (!response.ok) {
        throw new Error(`add role failed: ${response.status}`);
      }
    },
    async removeRole(userId, roleId) {
      const response = await fetchImpl(
        `${base}/members/${userId}/roles/${roleId}`,
        {
          method: "DELETE",
          headers: authHeaders(config.pluginToken),
        },
      );
      if (!response.ok) {
        throw new Error(`remove role failed: ${response.status}`);
      }
    },
  };
}

export interface SpacelabReconcileStateResponse {
  rows: Array<{
    discordHandle: string;
    status: string;
    adaptRoleValues: string[];
    discordUserId?: string;
  }>;
  links: Record<string, string>;
  rememberedMembers: Array<{ discordUserId: string; discordHandle: string }>;
  failures: Array<{ memberKey: string; discordHandle: string; attempts: number }>;
}

export async function fetchSpacelabReconcileState(
  config: MaiaPluginClientConfig,
): Promise<SpacelabReconcileStateResponse | null> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `${config.pluginUrl}/v1/guilds/${encodeURIComponent(config.guildId)}/spacelab-roster/reconcile-state`,
    { headers: authHeaders(config.pluginToken) },
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`reconcile state failed: ${response.status}`);
  }
  return (await response.json()) as SpacelabReconcileStateResponse;
}

export async function saveSpacelabReconcileState(
  config: MaiaPluginClientConfig,
  body: SpacelabReconcileStateResponse,
) {
  const fetchImpl = config.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `${config.pluginUrl}/v1/guilds/${encodeURIComponent(config.guildId)}/spacelab-roster/reconcile-state`,
    {
      method: "PUT",
      headers: {
        ...authHeaders(config.pluginToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    throw new Error(`save reconcile state failed: ${response.status}`);
  }
}
