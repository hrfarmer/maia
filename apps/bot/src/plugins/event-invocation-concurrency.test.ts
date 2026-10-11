import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PluginEventInvocationConcurrency } from "./event-invocation-concurrency.js";

describe("PluginEventInvocationConcurrency", () => {
  it("drops when the cap is full and accepts after release", () => {
    const tracker = new PluginEventInvocationConcurrency();
    assert.equal(tracker.tryAcquire("demo", 2), true);
    assert.equal(tracker.tryAcquire("demo", 2), true);
    assert.equal(tracker.tryAcquire("demo", 2), false);
    tracker.release("demo");
    assert.equal(tracker.tryAcquire("demo", 2), true);
  });
});
