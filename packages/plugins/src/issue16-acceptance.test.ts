import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { discoverPlugins } from "./discover.js";
import { PLUGIN_MANIFEST_FILENAME, parsePluginManifest } from "./manifest.js";
import { mockDiscoverFs, validManifest } from "./test-helpers.js";

describe("issue #16 acceptance", () => {
  it("valid folder shows display name, lifetime, and subscribed events", async () => {
    const entries = await discoverPlugins(
      mockDiscoverFs({
        directories: ["p"],
        files: new Map([
          [
            `/plugins/p/${PLUGIN_MANIFEST_FILENAME}`,
            JSON.stringify(
              validManifest({
                name: "My Plugin",
                lifetime: "always-on",
                subscribedEvents: ["member.leave"],
              }),
            ),
          ],
        ]),
      }),
    );
    assert.equal(entries[0]?.manifest?.name, "My Plugin");
    assert.equal(entries[0]?.manifest?.lifetime, "always-on");
    assert.deepEqual(entries[0]?.manifest?.subscribedEvents, ["member.leave"]);
  });

  it("invocation plugin with forbidden message event fails discovery", () => {
    assert.throws(() =>
      parsePluginManifest(
        validManifest({
          lifetime: "invocation",
          subscribedEvents: ["reaction.removed"],
        }),
      ),
    );
  });

  it("manifest defining MAIA_PLUGIN_URL fails discovery", () => {
    assert.throws(() =>
      parsePluginManifest(
        validManifest({
          environment: [{ key: "MAIA_PLUGIN_URL", required: false }],
        }),
      ),
    );
  });
});
