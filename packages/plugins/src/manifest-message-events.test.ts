import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePluginManifest } from "./manifest.js";
import { validManifest } from "./test-helpers.js";

describe("always-on message and reaction subscribedEvents", () => {
  it("accepts message.created, reaction.added, and reaction.removed", () => {
    assert.deepEqual(
      parsePluginManifest(
        validManifest({
          subscribedEvents: [
            "message.created",
            "reaction.added",
            "reaction.removed",
          ],
        }),
      ).subscribedEvents,
      ["message.created", "reaction.added", "reaction.removed"],
    );
  });
});
