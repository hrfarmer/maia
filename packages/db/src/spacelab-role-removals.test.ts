import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  spacelabIgnoreIsActive,
  spacelabIgnoreUntil,
} from "./spacelab-role-removals.js";

describe("spacelab role removal ignores", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  it("ignores for seven days or forever", () => {
    assert.equal(
      spacelabIgnoreUntil("week", now)?.toISOString(),
      "2026-01-08T00:00:00.000Z",
    );
    assert.equal(spacelabIgnoreUntil("forever", now), null);
  });

  it("treats a null end as permanent and a past end as expired", () => {
    assert.equal(spacelabIgnoreIsActive(null, now), true);
    assert.equal(
      spacelabIgnoreIsActive(new Date("2026-01-02T00:00:00.000Z"), now),
      true,
    );
    assert.equal(
      spacelabIgnoreIsActive(new Date("2025-12-31T00:00:00.000Z"), now),
      false,
    );
  });
});
