import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPluginRefreshPending } from "./plugins.js";

describe("plugin guild config cleanup seam", () => {
  it("documents refresh pending behavior used by hot reload", () => {
    assert.equal(isPluginRefreshPending(new Date("2026-01-02T00:00:00Z"), null), true);
  });
});
