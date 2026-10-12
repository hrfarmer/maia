import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isValidRosterSenderEmail,
  rosterSenderEmailMatches,
} from "./roster-sender-email.js";

describe("roster sender email", () => {
  it("matches case-insensitively with surrounding whitespace", () => {
    assert.equal(
      rosterSenderEmailMatches(
        "  Roster@Example.COM ",
        "roster@example.com",
      ),
      true,
    );
  });

  it("accepts any sender when unset", () => {
    assert.equal(rosterSenderEmailMatches(null, "anyone@example.com"), true);
    assert.equal(rosterSenderEmailMatches("  ", "anyone@example.com"), true);
  });

  it("validates email shape", () => {
    assert.equal(isValidRosterSenderEmail("roster@lab.edu"), true);
    assert.equal(isValidRosterSenderEmail("not-an-email"), false);
    assert.equal(isValidRosterSenderEmail("   "), false);
  });
});
