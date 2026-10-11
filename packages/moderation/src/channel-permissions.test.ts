import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Permission } from "@maia/discord";
import {
  botCanViewChannel,
  type DiscordGuildChannel,
} from "./channel-permissions.js";
import type { DiscordGuildMember, DiscordRole } from "./discord-bot.js";

const GUILD_ID = "100000000000000001";
const BOT_ID = "300000000000000003";
const BOT_ROLE = "400000000000000004";

function channel(
  id: string,
  overwrites: DiscordGuildChannel["permission_overwrites"] = [],
): DiscordGuildChannel {
  return {
    id,
    type: 0,
    name: id,
    permission_overwrites: overwrites,
  };
}

describe("botCanViewChannel", () => {
  const roles: DiscordRole[] = [
    {
      id: GUILD_ID,
      name: "@everyone",
      color: 0,
      position: 0,
      managed: false,
      permissions: Permission.ViewChannel.toString(),
    },
    {
      id: BOT_ROLE,
      name: "Maia",
      color: 0,
      position: 1,
      managed: false,
      permissions: "0",
    },
  ];
  const member: DiscordGuildMember = {
    user: { id: BOT_ID, username: "maia" },
    roles: [GUILD_ID, BOT_ROLE],
  };
  const channelsById = new Map<string, DiscordGuildChannel>();

  it("allows view when guild permissions include ViewChannel", () => {
    assert.equal(
      botCanViewChannel(
        member,
        channel("200000000000000010"),
        roles,
        GUILD_ID,
        BOT_ID,
        channelsById,
      ),
      true,
    );
  });

  it("denies view when the channel overwrites remove ViewChannel", () => {
    const denied = channel("200000000000000011", [
      {
        id: GUILD_ID,
        type: 0,
        allow: "0",
        deny: Permission.ViewChannel.toString(),
      },
    ]);
    assert.equal(
      botCanViewChannel(
        member,
        denied,
        roles,
        GUILD_ID,
        BOT_ID,
        channelsById,
      ),
      false,
    );
  });
});
