import "./load-env.js";
import { Client, Events, InteractionType, REST } from "discord.js";
import { BOT_GATEWAY_INTENTS } from "./client-intents.js";
import {
  getDb,
  getEnabledCustomCommandByName,
  listGuildPluginEnvValues,
  recordGuildJoin,
  recordGuildLeave,
  resolvePluginSlashCommand,
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
import { SlashReplyRegistry } from "./plugins/slash-reply-registry.js";
import { executeSlashRun } from "./plugins/execute-slash-run.js";

const token = process.env.DISCORD_TOKEN;
if (!token) {
  throw new Error("DISCORD_TOKEN is not set");
}

const db = getDb();

const slashContext: {
  tokenRegistry: PluginTokenRegistry;
  slashReplies: SlashReplyRegistry;
  pluginApiUrl: string;
  alwaysOnSupervisor: AlwaysOnSupervisor;
} = {
  tokenRegistry: new PluginTokenRegistry(),
  slashReplies: new SlashReplyRegistry(),
  pluginApiUrl: "",
  alwaysOnSupervisor: null as unknown as AlwaysOnSupervisor,
};

const client = new Client({
  intents: [...BOT_GATEWAY_INTENTS],
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

  const pluginSlash = await resolvePluginSlashCommand(
    db,
    guildId,
    interaction.commandName,
  );
  if (pluginSlash) {
    const envRows = await listGuildPluginEnvValues(
      db,
      guildId,
      pluginSlash.pluginId,
    );
    const guildValues: Record<string, string> = {};
    for (const row of envRows) {
      guildValues[row.envKey] = row.value;
    }
    void executeSlashRun({
      db,
      interaction,
      resolved: pluginSlash,
      guildValues,
      tokenRegistry: slashContext.tokenRegistry,
      slashReplies: slashContext.slashReplies,
      pluginApiUrl: slashContext.pluginApiUrl,
      alwaysOnSupervisor: slashContext.alwaysOnSupervisor,
      log: (line) => console.log(line),
    }).catch((error) => {
      console.error("Plugin slash command failed", error);
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
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!token || !clientId) {
    throw new Error("DISCORD_TOKEN and DISCORD_CLIENT_ID are required");
  }

  const tokenRegistry = slashContext.tokenRegistry;
  const slashReplies = slashContext.slashReplies;
  const pluginApi = createPluginApiServer({
    port: resolvePluginApiPort(),
    tokenRegistry,
    db,
    slashReplies,
  });
  await pluginApi.listen();
  console.log(`Plugin API listening on ${pluginApi.url()}`);
  slashContext.pluginApiUrl = pluginApi.url();

  const alwaysOnSupervisor = new AlwaysOnSupervisor({
    db,
    tokenRegistry,
    pluginApiUrl: pluginApi.url(),
    log: (line) => console.log(line),
  });
  slashContext.alwaysOnSupervisor = alwaysOnSupervisor;

  const rest = new REST({ version: "10" }).setToken(token);

  await runPluginScan(db, "startup", {
    afterScan: async () => {
      await alwaysOnSupervisor.syncFromLatestScan({ restartExisting: false });
    },
    rest,
    republishSlashCommands: true,
  });

  startPluginRefreshLoop(db, {
    afterRefreshScan: async () => {
      await alwaysOnSupervisor.syncFromLatestScan({ restartExisting: true });
    },
    rest,
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
