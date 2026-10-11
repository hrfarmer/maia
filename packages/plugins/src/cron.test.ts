import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cronMatchesUtcMinute,
  isValidCronExpression,
  utcMinuteStart,
} from "./cron.js";

describe("cron expression validation", () => {
  it("accepts a standard five-field UTC expression", () => {
    assert.equal(isValidCronExpression("0 * * * *"), true);
    assert.equal(isValidCronExpression("15 4 * * 1"), true);
  });

  it("rejects expressions that are not five fields or cannot parse", () => {
    assert.equal(isValidCronExpression(""), false);
    assert.equal(isValidCronExpression("not-a-cron"), false);
    assert.equal(isValidCronExpression("0 * * *"), false);
    assert.equal(isValidCronExpression("60 * * * *"), false);
  });
});

describe("cronMatchesUtcMinute", () => {
  it("matches when the current UTC minute is scheduled", () => {
    const at = new Date("2026-03-02T14:30:00.000Z");
    assert.equal(cronMatchesUtcMinute("30 14 * * *", at), true);
    assert.equal(cronMatchesUtcMinute("0 14 * * *", at), false);
  });

  it("matches hourly at minute zero", () => {
    const at = new Date("2026-03-02T09:00:00.000Z");
    assert.equal(cronMatchesUtcMinute("0 * * * *", at), true);
    assert.equal(cronMatchesUtcMinute("0 * * * *", new Date("2026-03-02T09:01:00.000Z")), false);
  });
});

describe("utcMinuteStart", () => {
  it("truncates to the UTC minute boundary", () => {
    const at = new Date("2026-03-02T09:00:45.123Z");
    assert.equal(utcMinuteStart(at).toISOString(), "2026-03-02T09:00:00.000Z");
  });
});
