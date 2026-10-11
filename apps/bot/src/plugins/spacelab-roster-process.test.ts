import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import type { Db } from "@maia/db";
import { buildAlwaysOnPluginProcessEnvironment } from "@maia/plugins";
import { createPluginApiServer } from "./plugin-api-server.js";
import { PluginTokenRegistry } from "./token-registry.js";

const repoRoot = path.resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../..",
);
const mainJs = path.join(
  repoRoot,
  "plugins",
  "spacelab-plugins",
  "main.js",
);

function spawnSpacelabProcess(env: Record<string, string>) {
  return spawn(process.execPath, [mainJs], {
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

async function waitForProcessExit(
  child: ReturnType<typeof spawnSpacelabProcess>,
  signal: NodeJS.Signals = "SIGKILL",
) {
  const exit = new Promise<number | null>((resolve) => {
    child.on("close", resolve);
  });
  child.kill(signal);
  return exit;
}

describe("Space Lab roster always-on process", () => {
  it("uses only Maia plugin env vars and rejects inherited host secrets", async () => {
    const clean = buildAlwaysOnPluginProcessEnvironment({
      pluginToken: "mplg_test",
      pluginUrl: "http://127.0.0.1:3847",
    });
    assert.deepEqual(Object.keys(clean).sort(), [
      "MAIA_PLUGIN_TOKEN",
      "MAIA_PLUGIN_URL",
    ]);

    const child = spawnSpacelabProcess({
      ...clean,
      DISCORD_TOKEN: "leaked",
    });
    const exitCode = await new Promise<number | null>((resolve) => {
      child.on("close", resolve);
    });
    assert.equal(exitCode, 1);
  });

  it("reads ROSTER_COLUMN from the localhost values API after values_saved", async () => {
    const registry = new PluginTokenRegistry();
    const token = registry.mintAlwaysOnToken("spacelab-roster");
    const enabledGuilds = new Set(["guild-1"]);
    const api = createPluginApiServer({
      port: 0,
      tokenRegistry: registry,
      db: {} as Db,
      assertGuildApiAccess: async (provided, guildId) => {
        const entry = registry.lookup(provided);
        if (!entry || entry.kind !== "always-on") {
          return null;
        }
        return enabledGuilds.has(guildId)
          ? { pluginId: entry.pluginId }
          : null;
      },
      loadGuildValues: async () => ({ ROSTER_COLUMN: "DiscordRoleColumn" }),
    });
    await api.listen();

    const env = buildAlwaysOnPluginProcessEnvironment({
      pluginToken: token,
      pluginUrl: api.url(),
    });
    const child = spawnSpacelabProcess(env);

    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });

    child.stdin.write('{"guildId":"guild-1","change":"values_saved"}\n');

    await new Promise((resolve) => setTimeout(resolve, 200));
    await waitForProcessExit(child);

    assert.match(stdout, /DiscordRoleColumn/);
    await api.close();
  });
});
