import { Permission } from "@maia/discord";

export const MOCK_GUILD_ID = "100000000000000001";
export const MOCK_MEMBER_ID = "200000000000000002";
export const MOCK_BOT_ID = "300000000000000003";
export const MOCK_ROLE_ID = "400000000000000004";
export const MOCK_BOT_ROLE_ID = "400000000000000005";

const manageRoles = Permission.ManageRoles.toString();
const kickMembers = Permission.KickMembers.toString();
const moderateMembers = Permission.ModerateMembers.toString();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export interface DiscordFetchMockOptions {
  channels?: Array<{ id: string; type: number; name: string }>;
  onCreateMessage?: (body: {
    content: string;
    message_reference?: { message_id: string };
  }) => { id: string; content: string };
  onListMessages?: (channelId: string, limit: number) => Array<{
    id: string;
    content: string;
  }>;
  onFetchMessage?: (channelId: string, messageId: string) => {
    id: string;
    content: string;
    author: { id: string };
  };
  everyonePermissions?: bigint;
}

export function installDiscordFetchMock(options: DiscordFetchMockOptions = {}) {
  const original = globalThis.fetch;
  let memberRoleIds = [MOCK_GUILD_ID];
  const everyonePermissions = (
    options.everyonePermissions ?? 0n
  ).toString();

  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (!url.includes("discord.com/api/v10")) {
      return original(input, init);
    }
    const path = (url.split("discord.com/api/v10")[1] ?? "").split("?")[0];

    if (path === "/users/@me") {
      return jsonResponse({ id: MOCK_BOT_ID });
    }
    if (path === `/guilds/${MOCK_GUILD_ID}`) {
      return jsonResponse({
        id: MOCK_GUILD_ID,
        name: "Test Guild",
        owner_id: "900000000000000009",
      });
    }
    if (path === `/guilds/${MOCK_GUILD_ID}/roles/${MOCK_ROLE_ID}`) {
      if (init?.method === "PATCH") {
        const body = JSON.parse(String(init.body ?? "{}")) as { name?: string };
        return jsonResponse({
          id: MOCK_ROLE_ID,
          name: body.name ?? "Member",
          color: 0,
          position: 1,
          managed: false,
          permissions: "0",
        });
      }
    }
    if (path === `/guilds/${MOCK_GUILD_ID}/roles`) {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body ?? "{}")) as { name: string };
        return jsonResponse({
          id: "500000000000000005",
          name: body.name,
          color: 0,
          position: 2,
          managed: false,
          permissions: "0",
        });
      }
      return jsonResponse([
        {
          id: MOCK_GUILD_ID,
          name: "@everyone",
          color: 0,
          position: 0,
          managed: false,
          permissions: everyonePermissions,
        },
        {
          id: MOCK_ROLE_ID,
          name: "Member",
          color: 0,
          position: 1,
          managed: false,
          permissions: "0",
        },
        {
          id: MOCK_BOT_ROLE_ID,
          name: "Maia",
          color: 0,
          position: 5,
          managed: false,
          permissions: manageRoles,
        },
      ]);
    }
    if (path === `/guilds/${MOCK_GUILD_ID}/members/${MOCK_BOT_ID}`) {
      return jsonResponse({
        user: { id: MOCK_BOT_ID, username: "maia-bot" },
        roles: [MOCK_GUILD_ID, MOCK_BOT_ROLE_ID],
      });
    }
    if (path === `/guilds/${MOCK_GUILD_ID}/members/${MOCK_MEMBER_ID}`) {
      if (init?.method === "PATCH") {
        return jsonResponse({
          user: { id: MOCK_MEMBER_ID, username: "target" },
          roles: memberRoleIds,
        });
      }
      if (init?.method === "DELETE") {
        return new Response(null, { status: 204 });
      }
      return jsonResponse({
        user: { id: MOCK_MEMBER_ID, username: "target" },
        roles: memberRoleIds,
        nick: null,
      });
    }
    if (path === `/guilds/${MOCK_GUILD_ID}/channels`) {
      return jsonResponse(options.channels ?? []);
    }
    const channelMessageMatch = path.match(/^\/channels\/([^/]+)\/messages$/);
    if (channelMessageMatch && (init?.method ?? "GET") === "GET") {
      const channelId = channelMessageMatch[1]!;
      const limit = Number(new URL(url).searchParams.get("limit") ?? "50");
      const messages =
        options.onListMessages?.(channelId, limit) ?? [
          { id: "300000000000000099", content: "Hello" },
        ];
      return jsonResponse(messages);
    }
    if (channelMessageMatch && init?.method === "POST") {
      const body = JSON.parse(String(init.body ?? "{}")) as {
        content: string;
        message_reference?: { message_id: string };
      };
      const created = options.onCreateMessage?.(body) ?? {
        id: "500000000000000006",
        content: body.content,
      };
      return jsonResponse(created, 201);
    }
    const channelMessageItemMatch = path.match(
      /^\/channels\/([^/]+)\/messages\/([^/]+)$/,
    );
    if (channelMessageItemMatch) {
      const channelId = channelMessageItemMatch[1]!;
      const messageId = channelMessageItemMatch[2]!;
      if ((init?.method ?? "GET") === "GET") {
        const message = options.onFetchMessage?.(channelId, messageId) ?? {
          id: messageId,
          content: "Hello",
          author: { id: MOCK_MEMBER_ID },
        };
        return jsonResponse(message);
      }
      if (init?.method === "DELETE") {
        return new Response(null, { status: 204 });
      }
    }
    const reactionMatch = path.match(
      /^\/channels\/([^/]+)\/messages\/([^/]+)\/reactions\/([^/]+)\/@me$/,
    );
    if (reactionMatch && (init?.method === "PUT" || init?.method === "DELETE")) {
      return new Response(null, { status: 204 });
    }
    if (
      path ===
      `/guilds/${MOCK_GUILD_ID}/members/${MOCK_MEMBER_ID}/roles/${MOCK_ROLE_ID}`
    ) {
      if (init?.method === "PUT") {
        if (!memberRoleIds.includes(MOCK_ROLE_ID)) {
          memberRoleIds = [...memberRoleIds, MOCK_ROLE_ID];
        }
      }
      if (init?.method === "DELETE") {
        memberRoleIds = memberRoleIds.filter((id) => id !== MOCK_ROLE_ID);
      }
      return new Response(null, { status: 204 });
    }
    return jsonResponse({ message: `Unhandled Discord mock: ${path}` }, 501);
  };
  return () => {
    globalThis.fetch = original;
  };
}

export function managerPermissions(): bigint {
  return Permission.Administrator;
}
