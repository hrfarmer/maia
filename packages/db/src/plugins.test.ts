import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPluginRefreshPending } from "./plugins.js";

describe("isPluginRefreshPending", () => {
  it("returns false when no refresh was requested", () => {
    assert.equal(isPluginRefreshPending(null, new Date("2026-01-01T00:00:00Z")), false);
  });

  it("returns true when refresh is newer than the last completed scan", () => {
    assert.equal(
      isPluginRefreshPending(
        new Date("2026-01-02T00:00:00Z"),
        new Date("2026-01-01T00:00:00Z"),
      ),
      true,
    );
  });

  it("returns false when the latest scan is at or after the refresh request", () => {
    assert.equal(
      isPluginRefreshPending(
        new Date("2026-01-01T00:00:00Z"),
        new Date("2026-01-01T00:00:00Z"),
      ),
      false,
    );
  });
});
