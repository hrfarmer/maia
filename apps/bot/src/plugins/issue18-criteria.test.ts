import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("issue #18 bot seams", () => {
  it("documents config notify and refresh hooks", async () => {
    const { startPluginConfigNotifyLoop } = await import(
      "./config-notify-loop.js"
    );
    const { startPluginRefreshLoop } = await import("./refresh-loop.js");
    assert.equal(typeof startPluginConfigNotifyLoop, "function");
    assert.equal(typeof startPluginRefreshLoop, "function");
  });
});
