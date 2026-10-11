import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  claimNextPluginGuildConfigNotification,
  enqueuePluginGuildConfigNotification,
} from "./plugin-guild-notifications.js";

describe("plugin guild config notifications", () => {
  it("exports enqueue and claim helpers for the bot stdin loop", () => {
    assert.equal(typeof enqueuePluginGuildConfigNotification, "function");
    assert.equal(typeof claimNextPluginGuildConfigNotification, "function");
  });
});
