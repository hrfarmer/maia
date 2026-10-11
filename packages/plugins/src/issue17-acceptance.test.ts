import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePluginManifest } from "./manifest.js";
import { validManifest } from "./test-helpers.js";

describe("issue #17 acceptance", () => {
  it("requires invocationTimeLimitMs on invocation manifests", () => {
    assert.throws(() =>
      parsePluginManifest(
        validManifest({
          lifetime: "invocation",
          invocationTimeLimitMs: undefined,
        }),
      ),
    );
    const manifest = parsePluginManifest(
      validManifest({
        lifetime: "invocation",
        invocationTimeLimitMs: 120_000,
      }),
    );
    assert.equal(manifest.invocationTimeLimitMs, 120_000);
  });
});
