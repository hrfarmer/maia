import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { discoverPlugins } from "./discover.js";
import { PLUGIN_MANIFEST_FILENAME } from "./manifest.js";
import { mockDiscoverFs, validManifest } from "./test-helpers.js";

describe("discoverPlugins", () => {
  it("shows display name, lifetime, and subscribed events for a valid folder", async () => {
    const manifest = validManifest({
      id: "welcome",
      name: "Welcome",
      lifetime: "invocation",
      subscribedEvents: ["role.create"],
    });
    const entries = await discoverPlugins(
      mockDiscoverFs({
        directories: ["welcome"],
        files: new Map([
          [
            `/plugins/welcome/${PLUGIN_MANIFEST_FILENAME}`,
            JSON.stringify(manifest),
          ],
        ]),
      }),
    );

    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.status, "ok");
    assert.deepEqual(entries[0]?.manifest?.subscribedEvents, ["role.create"]);
    assert.equal(entries[0]?.manifest?.lifetime, "invocation");
    assert.equal(entries[0]?.manifest?.name, "Welcome");
  });

  it("ignores loose files in the plugins directory", async () => {
    const entries = await discoverPlugins(
      mockDiscoverFs({
        directories: [],
        files: new Map(),
      }),
    );
    assert.deepEqual(entries, []);
  });

  it("marks unreadable manifests as errors", async () => {
    const path = `/plugins/broken/${PLUGIN_MANIFEST_FILENAME}`;
    const entries = await discoverPlugins(
      mockDiscoverFs({
        directories: ["broken"],
        unreadable: new Set([path]),
      }),
    );
    assert.equal(entries[0]?.status, "error");
    assert.match(entries[0]?.errorMessage ?? "", /permission denied/);
  });

  it("marks duplicate plugin ids as clashes on both folders", async () => {
    const manifest = validManifest({ id: "dupe", name: "One" });
    const entries = await discoverPlugins(
      mockDiscoverFs({
        directories: ["a", "b"],
        files: new Map([
          [`/plugins/a/${PLUGIN_MANIFEST_FILENAME}`, JSON.stringify(manifest)],
          [
            `/plugins/b/${PLUGIN_MANIFEST_FILENAME}`,
            JSON.stringify({ ...manifest, name: "Two" }),
          ],
        ]),
      }),
    );

    assert.equal(entries.length, 2);
    assert.equal(entries[0]?.status, "error");
    assert.equal(entries[1]?.status, "error");
    assert.match(entries[0]?.errorMessage ?? "", /Plugin id clash/);
  });

  it("drops removed folders on a later scan", async () => {
    const manifest = validManifest({ id: "gone", name: "Gone" });
    const first = await discoverPlugins(
      mockDiscoverFs({
        directories: ["gone"],
        files: new Map([
          [`/plugins/gone/${PLUGIN_MANIFEST_FILENAME}`, JSON.stringify(manifest)],
        ]),
      }),
    );
    const second = await discoverPlugins(
      mockDiscoverFs({
        directories: [],
        files: new Map(),
      }),
    );
    assert.equal(first.length, 1);
    assert.equal(second.length, 0);
  });

  it("treats a changed manifest id as a new plugin and drops the old id", async () => {
    const first = await discoverPlugins(
      mockDiscoverFs({
        directories: ["pkg"],
        files: new Map([
          [
            `/plugins/pkg/${PLUGIN_MANIFEST_FILENAME}`,
            JSON.stringify(validManifest({ id: "old-id", name: "Old" })),
          ],
        ]),
      }),
    );
    const second = await discoverPlugins(
      mockDiscoverFs({
        directories: ["pkg"],
        files: new Map([
          [
            `/plugins/pkg/${PLUGIN_MANIFEST_FILENAME}`,
            JSON.stringify(validManifest({ id: "new-id", name: "New" })),
          ],
        ]),
      }),
    );
    assert.equal(first[0]?.manifest?.id, "old-id");
    assert.equal(second[0]?.manifest?.id, "new-id");
    assert.notEqual(first[0]?.manifest?.id, second[0]?.manifest?.id);
  });

  it("does not execute plugin commands during discovery", async () => {
    const source = await import("node:fs/promises");
    const entries = await discoverPlugins(
      mockDiscoverFs({
        directories: ["demo"],
        files: new Map([
          [
            `/plugins/demo/${PLUGIN_MANIFEST_FILENAME}`,
            JSON.stringify(validManifest({ command: ["node", "never-run.js"] })),
          ],
        ]),
      }),
    );
    assert.equal(entries[0]?.status, "ok");
    assert.equal(typeof source.readFile, "function");
  });
});
