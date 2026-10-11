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

export function installDiscordFetchMock() {
  const original = globalThis.fetch;
  let memberRoleIds = [MOCK_GUILD_ID];

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
          permissions: "0",
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
