import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GatewayIntentBits } from "discord.js";
import { BOT_GATEWAY_INTENTS } from "./client-intents.js";

const REQUIRED_INTENTS =
  GatewayIntentBits.Guilds |
  GatewayIntentBits.GuildMembers |
  GatewayIntentBits.GuildMessages |
  GatewayIntentBits.GuildMessageReactions |
  GatewayIntentBits.MessageContent;

describe("BOT_GATEWAY_INTENTS", () => {
  it("includes guild, member, and message intents", () => {
    let combined = 0;
    for (const intent of BOT_GATEWAY_INTENTS) {
      combined |= intent;
    }
    assert.equal(combined, REQUIRED_INTENTS);
  });
});
