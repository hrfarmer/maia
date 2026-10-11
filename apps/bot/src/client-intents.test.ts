import assert from "node:assert/strict";
import { Partials } from "discord.js";
import { describe, it } from "node:test";
import { BOT_GATEWAY_PARTIALS } from "./client-intents.js";

describe("BOT_GATEWAY_PARTIALS", () => {
  it("includes message and reaction partials for uncached reaction payloads", () => {
    assert.ok(BOT_GATEWAY_PARTIALS.includes(Partials.Message));
    assert.ok(BOT_GATEWAY_PARTIALS.includes(Partials.Reaction));
  });
});
