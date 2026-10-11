import readline from "node:readline";
import { runSpacelabGuildReconcile } from "./reconcile.mjs";

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

async function fetchRosterColumn(guildId) {
  const response = await fetch(
    `${pluginUrl}/v1/guilds/${encodeURIComponent(guildId)}/values`,
    {
      headers: { Authorization: `Bearer ${pluginToken}` },
    },
  );
  if (!response.ok) {
    return null;
  }
  const body = await response.json();
  const values = body?.values;
  if (!values || typeof values !== "object") {
    return null;
  }
  const column = values.ROSTER_COLUMN;
  return typeof column === "string" ? column : null;
}

async function runReconcileForGuild(guildId, change) {
  const rosterColumn = await fetchRosterColumn(guildId);
  if (rosterColumn !== null) {
    process.stdout.write(
      `${JSON.stringify({ guildId, rosterColumn, change })}\n`,
    );
  }
  try {
    const result = await runSpacelabGuildReconcile({
      pluginUrl,
      pluginToken,
      guildId,
      fetchImpl: fetch,
    });
    process.stdout.write(
      `${JSON.stringify({ guildId, reconcile: result })}\n`,
    );
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({
        guildId,
        reconcile: {
          ok: false,
          error: error instanceof Error ? error.message : "reconcile_failed",
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
    if (
      change !== "enabled" &&
      change !== "values_saved" &&
      change !== "adapt_roles_saved"
    ) {
      return;
    }
    await runReconcileForGuild(message.guildId, change);
  })();
});
