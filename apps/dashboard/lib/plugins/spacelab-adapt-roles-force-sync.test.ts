import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAlwaysOnGuildConfigStdin } from "@maia/plugins";

describe("spacelab adapt roles force sync", () => {
  it("queues an always-on stdin line for force sync", () => {
    const line = buildAlwaysOnGuildConfigStdin(
      "guild-1",
      "force_sync_requested",
    );
    assert.equal(
      line,
      '{"guildId":"guild-1","change":"force_sync_requested"}\n',
    );
  });
});
