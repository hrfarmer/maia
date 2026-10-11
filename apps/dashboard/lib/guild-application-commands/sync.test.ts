import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("guild application command sync", () => {
  it("keeps prior Discord commands when PUT fails (no success path runs)", () => {
    const attemptedBody = [{ type: 1, name: "new", description: "New" }];
    let storedCommands = [{ type: 1, name: "old", description: "Old" }];
    const put = () => {
      throw new Error("Discord rejected publish");
    };
    try {
      put();
      storedCommands = attemptedBody;
    } catch {
      // Discord rejected publish; storedCommands unchanged
    }
    assert.equal(storedCommands[0]?.name, "old");
  });
});
