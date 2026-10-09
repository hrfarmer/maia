import { SlashCommandBuilder } from "discord.js";
import type { MaiaCommand } from "./types.js";

export const helloCommand: MaiaCommand = {
  data: new SlashCommandBuilder()
    .setName("hello")
    .setDescription("Say hello"),
  async execute(interaction) {
    await interaction.reply("hello world");
  },
};
