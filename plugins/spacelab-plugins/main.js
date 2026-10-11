import readline from "node:readline";
import {
  createGraphMailboxClient,
  resolveGraphBaseUrl,
  runSpacelabGuildCycle,
  startSpacelabMinutePoll,
} from "./reconcile.mjs";

const pluginToken = process.env.MAIA_PLUGIN_TOKEN;
const pluginUrl = process.env.MAIA_PLUGIN_URL;

if (!pluginToken || !pluginUrl) {
  console.error("Missing MAIA_PLUGIN_TOKEN or MAIA_PLUGIN_URL");
  process.exit(1);
}

for (const forbidden of ["DISCORD_TOKEN", "DATABASE_URL", "ROSTER_COLUMN"]) {
  if (process.env[forbidden] !== undefined) {
    console.error(`Unexpected env var: ${forbidden}`);
    process.exit(1);
  }
}

const graph = createGraphMailboxClient({
  baseUrl: resolveGraphBaseUrl(process.env),
  fetchImpl: fetch,
});

if (process.env.MAIA_SPACELAB_DISABLE_POLL !== "1") {
  startSpacelabMinutePoll({
    pluginUrl,
    pluginToken,
    fetchImpl: fetch,
    graph,
  });
}

async function runCycleForGuild(guildId, options = {}) {
  try {
    const result = await runSpacelabGuildCycle({
      config: {
        pluginUrl,
        pluginToken,
        guildId,
        fetchImpl: fetch,
      },
      graph,
      forceFullPass: options.forceFullPass === true,
    });
    process.stdout.write(
      `${JSON.stringify({ guildId, cycle: result })}\n`,
    );
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({
        guildId,
        cycle: {
          ok: false,
          error: error instanceof Error ? error.message : "cycle_failed",
        },
      })}\n`,
    );
  }
}

const rl = readline.createInterface({ input: process.stdin });

rl.on("line", (line) => {
  void (async () => {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (!message || typeof message.guildId !== "string") {
      return;
    }
    const change = message.change;
    if (change === "disabled") {
      return;
    }
    if (
      change !== "enabled" &&
      change !== "values_saved" &&
      change !== "adapt_roles_saved"
    ) {
      return;
    }
    if (change === "adapt_roles_saved") {
      await runCycleForGuild(message.guildId, { forceFullPass: true });
      return;
    }
    await runCycleForGuild(message.guildId);
  })();
});
