import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { devPluginScan } from "@/lib/dev-fixtures";

describe("dev plugin scan fixture", () => {
  it("includes one valid plugin and one error plugin for UI screenshots", () => {
    assert.equal(devPluginScan.plugins.length, 2);
    assert.equal(devPluginScan.plugins[0]?.status, "ok");
    assert.equal(devPluginScan.plugins[1]?.status, "error");
  });
});
