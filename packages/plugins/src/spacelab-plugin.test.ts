import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, it } from "node:test";
import { discoverPlugins } from "./discover.js";
import {
  PLUGIN_MANIFEST_FILENAME,
  parsePluginManifest,
} from "./manifest.js";
import {
  SPACELAB_ROSTER_PLUGIN_ID,
  SPACELAB_PLUGINS_DIRECTORY_NAME,
} from "./shipped-spacelab-sync.js";

const repoRoot = path.resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../..",
);
const spacelabDir = path.join(repoRoot, "plugins", SPACELAB_PLUGINS_DIRECTORY_NAME);

describe("Space Lab roster shipped plugin", () => {
  it("ships a valid always-on manifest with required non-secret ROSTER_COLUMN", async () => {
    const raw = JSON.parse(
      await fs.readFile(
        path.join(spacelabDir, PLUGIN_MANIFEST_FILENAME),
        "utf8",
      ),
    );
    const manifest = parsePluginManifest(raw);
    assert.equal(manifest.id, SPACELAB_ROSTER_PLUGIN_ID);
    assert.equal(manifest.name, "Space Lab roster");
    assert.equal(manifest.lifetime, "always-on");
    assert.deepEqual(manifest.subscribedEvents, []);
    assert.deepEqual(manifest.command, ["node", "main.js"]);
    assert.deepEqual(manifest.environment, [
      { key: "ROSTER_COLUMN", required: true, secret: false },
    ]);
  });

  it("ships a bundled reconcile module built from the TypeScript pass", async () => {
    const reconcilePath = path.join(spacelabDir, "reconcile.mjs");
    await fs.access(reconcilePath);
    const mod = await import(
      `${pathToFileURL(reconcilePath).href}?t=${Date.now()}`
    );
    assert.equal(typeof mod.runSpacelabGuildReconcile, "function");
  });

  it("is discovered without executing the plugin command", async () => {
    const entries = await discoverPlugins({
      pluginsDir: path.join(repoRoot, "plugins"),
    });
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.status, "ok");
    assert.equal(entries[0]?.manifest?.id, SPACELAB_ROSTER_PLUGIN_ID);
  });

  it("is not runnable when the manifest is invalid", async () => {
    assert.throws(() =>
      parsePluginManifest({
        id: SPACELAB_ROSTER_PLUGIN_ID,
        name: "Space Lab roster",
        lifetime: "always-on",
        subscribedEvents: [],
        command: [],
        environment: [],
      }),
    );
  });
});
