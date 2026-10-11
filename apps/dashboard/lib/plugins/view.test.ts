import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { devPluginScan } from "@/lib/dev-fixtures";

describe("dev plugin scan fixture", () => {
  it("includes always-on, invocation, spacelab-roster, and error rows for screenshots", () => {
    assert.equal(devPluginScan.plugins.length, 4);
    assert.equal(devPluginScan.plugins[0]?.lifetime, "always-on");
    assert.equal(devPluginScan.plugins[1]?.lifetime, "invocation");
    assert.equal(devPluginScan.plugins[2]?.pluginId, "spacelab-roster");
    assert.equal(devPluginScan.plugins[3]?.status, "error");
  });
});
