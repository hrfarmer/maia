import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import {
  DEFAULT_DOCKER_PLUGINS_DIR,
  resolvePluginsDirectory,
} from "./paths.js";

describe("resolvePluginsDirectory", () => {
  it("uses MAIA_PLUGINS_DIR when set", () => {
    const dir = resolvePluginsDirectory({ MAIA_PLUGINS_DIR: "/data/plugins" });
    assert.equal(dir, path.resolve("/data/plugins"));
  });

  it("defaults to /app/plugins in docker production", () => {
    const dir = resolvePluginsDirectory({
      MAIA_DOCKER: "1",
      NODE_ENV: "production",
    });
    assert.equal(dir, DEFAULT_DOCKER_PLUGINS_DIR);
  });
});
