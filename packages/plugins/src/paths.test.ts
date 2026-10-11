import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { resolvePluginsDirectory } from "./paths.js";

describe("resolvePluginsDirectory", () => {
  it("uses MAIA_PLUGINS_DIR when set", () => {
    const dir = resolvePluginsDirectory({ MAIA_PLUGINS_DIR: "/data/plugins" });
    assert.equal(dir, path.resolve("/data/plugins"));
  });

  it("defaults to plugins under the bot working directory", () => {
    const dir = resolvePluginsDirectory({}, "/srv/bot");
    assert.equal(dir, path.resolve("/srv/bot", "plugins"));
  });
});
