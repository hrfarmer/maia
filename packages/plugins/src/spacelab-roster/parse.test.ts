import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SYNTHETIC_LAB_ROSTER_EXPORT,
  SYNTHETIC_LAB_ROSTER_EXPORT_INVALID_ROW,
} from "./fixture.js";
import {
  isLabRosterExportMessage,
  parseLabRosterMessage,
  rosterStatusIsActive,
} from "./parse.js";

describe("parseLabRosterMessage", () => {
  it("accepts only messages whose header includes DiscordHandle, Status, and ROSTER_COLUMN", () => {
    assert.equal(isLabRosterExportMessage(SYNTHETIC_LAB_ROSTER_EXPORT, "Subteam"), true);
    assert.equal(
      isLabRosterExportMessage(
        "DiscordHandle\tStatus\tOther\nx\ty\tz",
        "Subteam",
      ),
      false,
    );
    assert.equal(isLabRosterExportMessage("", "Subteam"), false);
  });

  it("collects Value strings only from the configured column and ignores #Id companions", () => {
    const parsed = parseLabRosterMessage(SYNTHETIC_LAB_ROSTER_EXPORT, "Subteam");
    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }
    assert.deepEqual(parsed.adaptRoleValues, ["Alpha", "Beta", "Delta", "Gamma"]);
    const roleColumnParse = parseLabRosterMessage(
      SYNTHETIC_LAB_ROSTER_EXPORT,
      "Role",
    );
    assert.equal(roleColumnParse.ok, true);
    if (!roleColumnParse.ok) {
      return;
    }
    assert.deepEqual(roleColumnParse.adaptRoleValues, [
      "IgnoreRole",
      "IgnoreRole2",
      "IgnoreRole3",
    ]);
  });

  it("keeps Status on each row and does not treat Status as an ADAPT Role value", () => {
    const parsed = parseLabRosterMessage(SYNTHETIC_LAB_ROSTER_EXPORT, "Subteam");
    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }
    const userA = parsed.rows.find((row) => row.discordHandle === "user.a");
    assert.ok(userA);
    assert.equal(userA.status, "Inactive");
    assert.ok(!parsed.adaptRoleValues.includes("Active"));
    assert.ok(!parsed.adaptRoleValues.includes("Inactive"));
  });

  it("merges rows with the same Discord handle case-insensitively and unions column values", () => {
    const parsed = parseLabRosterMessage(SYNTHETIC_LAB_ROSTER_EXPORT, "Subteam");
    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }
    assert.equal(parsed.rows.length, 2);
    const userA = parsed.rows.find((row) => row.discordHandle === "user.a");
    assert.ok(userA);
    assert.deepEqual(userA.adaptRoleValues.sort(), ["Alpha", "Beta"]);
  });

  it("matches Active case-insensitively for later application while storing parsed status", () => {
    assert.equal(rosterStatusIsActive("Active"), true);
    assert.equal(rosterStatusIsActive("active"), true);
    assert.equal(rosterStatusIsActive("Inactive"), false);
  });

  it("rejects the whole message when any row cannot be parsed", () => {
    const parsed = parseLabRosterMessage(
      SYNTHETIC_LAB_ROSTER_EXPORT_INVALID_ROW,
      "Subteam",
    );
    assert.equal(parsed.ok, false);
  });
});
