import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePluginManifest, PluginManifestError } from "./manifest.js";

describe("parsePluginManifest", () => {
  it("accepts a valid manifest", () => {
    assert.deepEqual(parsePluginManifest({
      id: "welcome",
      name: "Welcome",
      version: "1.0.0",
    }), {
      id: "welcome",
      name: "Welcome",
      version: "1.0.0",
    });
  });

  it("rejects missing manifest file fields", () => {
    assert.throws(
      () => parsePluginManifest({ name: "X", version: "1.0.0" }),
      (error: unknown) =>
        error instanceof PluginManifestError &&
        error.message === "id must be a string",
    );
  });

  it("rejects invalid id and version formats", () => {
    assert.throws(
      () =>
        parsePluginManifest({
          id: "Bad-ID",
          name: "Bad",
          version: "v1",
        }),
      (error: unknown) =>
        error instanceof PluginManifestError &&
        error.message.includes("id must start with a lowercase letter"),
    );
  });
});
