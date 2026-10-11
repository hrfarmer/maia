import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidCronExpression } from "@maia/plugins";

describe("guild plugin cron validation", () => {
  it("rejects invalid cron expressions before storage", () => {
    assert.equal(isValidCronExpression("not valid"), false);
    assert.equal(isValidCronExpression("0 * * * *"), true);
  });
});
