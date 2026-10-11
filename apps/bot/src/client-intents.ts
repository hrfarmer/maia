import { GatewayIntentBits, Partials } from "discord.js";

export const BOT_GATEWAY_INTENTS = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMessageReactions,
  GatewayIntentBits.MessageContent,
] as const;

/** Uncached messages for reaction events may be partial without these. */
export const BOT_GATEWAY_PARTIALS = [
  Partials.Message,
  Partials.Reaction,
  Partials.Channel,
] as const;
