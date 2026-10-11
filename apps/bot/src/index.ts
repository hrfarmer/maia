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
import { AlwaysOnSupervisor } from "./plugins/always-on-supervisor.js";
import { startPluginConfigNotifyLoop } from "./plugins/config-notify-loop.js";
import { createPluginApiServer } from "./plugins/plugin-api-server.js";
import { startPluginRefreshLoop } from "./plugins/refresh-loop.js";
import { runPluginScan } from "./plugins/run-scan.js";
import { startPluginCronLoop } from "./plugins/cron-loop.js";
import { startPluginRuntimeLoop } from "./plugins/runtime-loop.js";
import { PluginTokenRegistry } from "./plugins/token-registry.js";
import { PluginEventInvocationConcurrency } from "./plugins/event-invocation-concurrency.js";
import { registerMemberRoleGatewayEvents } from "./plugins/register-member-role-events.js";

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
    await interaction.reply({
      content: custom.responseText,
      ephemeral: custom.ephemeral,
    });
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

function resolvePluginApiPort(): number {
  const raw = process.env.MAIA_PLUGIN_API_PORT ?? "3847";
  const port = Number.parseInt(raw, 10);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("MAIA_PLUGIN_API_PORT must be a positive integer");
  }
  return port;
}

async function bootstrap() {
  const tokenRegistry = new PluginTokenRegistry();
  const pluginApi = createPluginApiServer({
    port: resolvePluginApiPort(),
    tokenRegistry,
    db,
  });
  await pluginApi.listen();
  console.log(`Plugin API listening on ${pluginApi.url()}`);

  const alwaysOnSupervisor = new AlwaysOnSupervisor({
    db,
    tokenRegistry,
    pluginApiUrl: pluginApi.url(),
    log: (line) => console.log(line),
  });

  await runPluginScan(db, "startup", {
    afterScan: async () => {
      await alwaysOnSupervisor.syncFromLatestScan({ restartExisting: false });
    },
  });

  startPluginRefreshLoop(db, {
    afterRefreshScan: async () => {
      await alwaysOnSupervisor.syncFromLatestScan({ restartExisting: true });
    },
  });

  startPluginConfigNotifyLoop(db, alwaysOnSupervisor);

  startPluginRuntimeLoop(db, {
    tokenRegistry,
    pluginApiUrl: pluginApi.url(),
    log: (line) => console.log(line),
  });
  startPluginCronLoop(db);

  const eventInvocationConcurrency = new PluginEventInvocationConcurrency();
  registerMemberRoleGatewayEvents({
    client,
    db,
    alwaysOnSupervisor,
    tokenRegistry,
    pluginApiUrl: pluginApi.url(),
    concurrency: eventInvocationConcurrency,
    log: (line) => console.log(line),
  });

  await client.login(token);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
