import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  SPACELAB_PLUGINS_DIRECTORY_NAME,
  syncShippedSpacelabPlugin,
} from "./shipped-spacelab-sync.js";

async function writeFileEnsuringDir(filePath: string, contents: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, "utf8");
}

describe("syncShippedSpacelabPlugin", () => {
  it("overwrites spacelab-plugins with the shipped copy and leaves other folders alone", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "maia-spacelab-sync-"));
    const shippedRoot = path.join(root, "shipped-plugins");
    const pluginsDir = path.join(root, "plugins");
    const source = path.join(shippedRoot, SPACELAB_PLUGINS_DIRECTORY_NAME);
    const destination = path.join(pluginsDir, SPACELAB_PLUGINS_DIRECTORY_NAME);
    const otherPlugin = path.join(pluginsDir, "custom-plugin", "keep.txt");

    await writeFileEnsuringDir(
      path.join(source, "maia-plugin.json"),
      '{"id":"spacelab-roster"}',
    );
    await writeFileEnsuringDir(path.join(source, "main.js"), "// shipped");
    await writeFileEnsuringDir(
      path.join(destination, "maia-plugin.json"),
      '{"stale":true}',
    );
    await writeFileEnsuringDir(otherPlugin, "stay");

    const result = await syncShippedSpacelabPlugin({
      env: {
        MAIA_SHIPPED_PLUGINS_DIR: shippedRoot,
        MAIA_PLUGINS_DIR: pluginsDir,
      },
      cwd: root,
    });

    assert.equal(result.synced, true);
    assert.equal(
      await fs.readFile(path.join(destination, "main.js"), "utf8"),
      "// shipped",
    );
    assert.equal(await fs.readFile(otherPlugin, "utf8"), "stay");
  });

  it("no-ops when the shipped copy is missing", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "maia-spacelab-miss-"));
    const pluginsDir = path.join(root, "plugins");
    await fs.mkdir(pluginsDir, { recursive: true });

    const result = await syncShippedSpacelabPlugin({
      env: {
        MAIA_SHIPPED_PLUGINS_DIR: path.join(root, "missing-shipped"),
        MAIA_PLUGINS_DIR: pluginsDir,
      },
      cwd: root,
    });

    assert.equal(result.synced, false);
    assert.equal(result.reason, "source-missing");
  });
});
