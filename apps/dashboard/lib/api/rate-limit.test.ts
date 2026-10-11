import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RATE_LIMIT_MAX_REQUESTS,
  checkRateLimit,
} from "../rate-limit";

describe("external API rate limit", () => {
  it("rejects after the per-key quota is exhausted", () => {
    const key = `test-key-${Date.now()}`;
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      const result = checkRateLimit(key);
      assert.equal(result.ok, true);
    }
    const limited = checkRateLimit(key);
    assert.equal(limited.ok, false);
    if (!limited.ok) {
      assert.ok(limited.retryAfterSec >= 1);
    }
  });

  it("does not share buckets between unrelated keys", () => {
    const a = `key-a-${Date.now()}`;
    const b = `key-b-${Date.now()}`;
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      checkRateLimit(a);
    }
    assert.equal(checkRateLimit(b).ok, true);
  });
});
