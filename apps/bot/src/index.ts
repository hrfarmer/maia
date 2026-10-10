import "./load-env.js";
import {
  Client,
  Events,
  GatewayIntentBits,
  InteractionType,
} from "discord.js";
import {
  getDb,
  getEnabledCustomCommandByName,
  recordGuildJoin,
  recordGuildLeave,
} from "@maia/db";
import { commandsByName } from "./commands/index.js";
import { isUserFacingError } from "./lib/errors.js";

const token = process.env.DISCORD_TOKEN;
if (!token) {
  throw new Error("DISCORD_TOKEN is not set");
}

const db = getDb();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  for (const guild of readyClient.guilds.cache.values()) {
    try {
      await recordGuildJoin(db, guild.id, guild.name);
    } catch (error) {
      console.error(`Failed to sync guild ${guild.id}`, error);
    }
  }
});

client.on(Events.GuildCreate, async (guild) => {
  try {
    await recordGuildJoin(db, guild.id, guild.name);
    console.log(`Joined guild ${guild.name} (${guild.id})`);
  } catch (error) {
    console.error("Failed to record guild join", error);
  }
});

client.on(Events.GuildDelete, async (guild) => {
  try {
    await recordGuildLeave(db, guild.id);
    console.log(`Left guild ${guild.id}`);
  } catch (error) {
    console.error("Failed to record guild leave", error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.type !== InteractionType.ApplicationCommand) {
    return;
  }
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const builtIn = commandsByName.get(interaction.commandName);
  if (builtIn) {
    try {
      await builtIn.execute(interaction);
    } catch (error) {
      console.error(error);
      const payload = {
        content: isUserFacingError(error)
          ? error.message
          : "Something went wrong.",
        ephemeral: true,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    }
    return;
  }

  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({
      content: "This command can only be used in a server.",
      ephemeral: true,
    });
    return;
  }

  const custom = await getEnabledCustomCommandByName(
    db,
    guildId,
    interaction.commandName,
  );
  if (!custom) {
    await interaction.reply({
      content: "This command is not available.",
      ephemeral: true,
    });
    return;
  }

  try {
    await interaction.reply({ content: custom.responseText });
  } catch (error) {
    console.error(error);
    const payload = {
      content: "Something went wrong.",
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  }
});

async function bootstrap() {
  await client.login(token);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
