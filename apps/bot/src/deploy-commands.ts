import "./load-env.js";
import { REST, Routes } from "discord.js";
import { commands } from "./commands/index.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const devGuildId = process.env.DISCORD_DEV_GUILD_ID;

if (!token || !clientId) {
  throw new Error("DISCORD_TOKEN and DISCORD_CLIENT_ID are required");
}

const appId = clientId;
const botToken = token;

const body = commands.map((command) => command.data.toJSON());
const rest = new REST({ version: "10" }).setToken(botToken);

async function deploy() {
  if (devGuildId) {
    await rest.put(Routes.applicationGuildCommands(appId, devGuildId), {
      body,
    });
    console.log(`Registered ${body.length} guild command(s) to ${devGuildId}`);
    return;
  }

  await rest.put(Routes.applicationCommands(appId), { body });
  console.log(`Registered ${body.length} global command(s)`);
}

deploy().catch((error) => {
  console.error(error);
  process.exit(1);
});
