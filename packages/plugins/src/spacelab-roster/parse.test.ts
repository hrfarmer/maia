import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SYNTHETIC_LAB_ROSTER_EXPORT,
  SYNTHETIC_LAB_ROSTER_EXPORT_CSV,
  SYNTHETIC_LAB_ROSTER_EXPORT_CSV_INVALID_ROW,
  SYNTHETIC_LAB_ROSTER_EXPORT_CSV_SPACE_SEPARATED,
  SYNTHETIC_LAB_ROSTER_EXPORT_CSV_SPACE_SEPARATED_MULTIWORD_TITLE,
  SYNTHETIC_LAB_ROSTER_EXPORT_INVALID_ROW,
  SYNTHETIC_LAB_ROSTER_EXPORT_PRODUCTION_SHAPE,
  SYNTHETIC_LAB_ROSTER_EXPORT_PRODUCTION_SHAPE_WITH_SKIPPED_ROWS,
  buildProductionShapeLabRosterExport,
  PRODUCTION_SHAPE_LAB_ROSTER_HEADERS,
} from "./fixture.js";
import {
  isLabRosterExportMessage,
  labRosterExportHeaders,
  labRosterNotRecognizedReason,
  normalizeLabRosterMessageBody,
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

  it("parses Power Automate CSV exports with extra columns and quoted lookup JSON", () => {
    assert.equal(
      isLabRosterExportMessage(SYNTHETIC_LAB_ROSTER_EXPORT_CSV, "Subteam"),
      true,
    );
    const parsed = parseLabRosterMessage(
      SYNTHETIC_LAB_ROSTER_EXPORT_CSV,
      "Subteam",
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }
    assert.deepEqual(parsed.adaptRoleValues, ["Alpha", "Beta", "Delta", "Gamma"]);
  });

  it("rejects invalid CSV roster rows without accepting partial data", () => {
    const parsed = parseLabRosterMessage(
      SYNTHETIC_LAB_ROSTER_EXPORT_CSV_INVALID_ROW,
      "Subteam",
    );
    assert.equal(parsed.ok, false);
  });

  it("strips a UTF-8 BOM and CRLF line endings before parsing", () => {
    const withBom = `\ufeff${SYNTHETIC_LAB_ROSTER_EXPORT_CSV.replace(/\n/g, "\r\n")}`;
    assert.equal(isLabRosterExportMessage(withBom, "Subteam"), true);
  });

  it("extracts CSV from HTML bodies when Graph returns HTML", () => {
    const html = `<html><body><pre>${SYNTHETIC_LAB_ROSTER_EXPORT_CSV.replace(/&/g, "&amp;")}</pre></body></html>`;
    const plain = normalizeLabRosterMessageBody(html);
    assert.equal(isLabRosterExportMessage(plain, "Subteam"), true);
  });

  it("parses Power Automate CSV when records are separated by whitespace instead of newlines", () => {
    assert.equal(
      isLabRosterExportMessage(
        SYNTHETIC_LAB_ROSTER_EXPORT_CSV_SPACE_SEPARATED,
        "Subteam",
      ),
      true,
    );
    const parsed = parseLabRosterMessage(
      SYNTHETIC_LAB_ROSTER_EXPORT_CSV_SPACE_SEPARATED,
      "Subteam",
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }
    assert.equal(parsed.rows.length, 2);
    assert.deepEqual(parsed.adaptRoleValues, ["Alpha", "Beta", "Delta", "Gamma"]);
  });

  it("does not treat unquoted spaces inside a field as record boundaries", () => {
    const parsed = parseLabRosterMessage(
      SYNTHETIC_LAB_ROSTER_EXPORT_CSV_SPACE_SEPARATED_MULTIWORD_TITLE,
      "Subteam",
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }
    assert.equal(parsed.rows.length, 2);
  });

  it("logs non-PII parse structure with header width, record count, and rejection tallies", () => {
    const lines: string[] = [];
    const originalLog = console.log;
    console.log = (line: string) => {
      lines.push(line);
    };
    try {
      parseLabRosterMessage(
        SYNTHETIC_LAB_ROSTER_EXPORT_CSV_SPACE_SEPARATED,
        "Subteam",
      );
    } finally {
      console.log = originalLog;
    }
    const structural = lines.find((line) => line.includes("spacelabRosterParse"));
    assert.ok(structural);
    const payload = JSON.parse(structural!) as {
      spacelabRosterParse: { headerColumnCount: number; recordCount: number };
    };
    assert.equal(payload.spacelabRosterParse.headerColumnCount, 10);
    assert.equal(payload.spacelabRosterParse.recordCount, 3);
  });

  it("treats a valid header with zero data rows as a parse failure", () => {
    const headerOnly = SYNTHETIC_LAB_ROSTER_EXPORT_CSV.split("\n")[0]!;
    const parsed = parseLabRosterMessage(headerOnly, "Subteam");
    assert.equal(parsed.ok, false);
    if (parsed.ok) {
      return;
    }
    assert.equal(parsed.reason, "roster_no_rows");
  });

  it("parses one-line production-shaped exports when the last column is often empty", () => {
    assert.deepEqual(
      labRosterExportHeaders(SYNTHETIC_LAB_ROSTER_EXPORT_PRODUCTION_SHAPE),
      [...PRODUCTION_SHAPE_LAB_ROSTER_HEADERS],
    );
    assert.equal(
      isLabRosterExportMessage(
        SYNTHETIC_LAB_ROSTER_EXPORT_PRODUCTION_SHAPE,
        "Subteam",
      ),
      true,
    );
    const parsed = parseLabRosterMessage(
      SYNTHETIC_LAB_ROSTER_EXPORT_PRODUCTION_SHAPE,
      "Subteam",
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }
    assert.equal(parsed.rows.length, 36);
    assert.equal(PRODUCTION_SHAPE_LAB_ROSTER_HEADERS.length, 42);
    assert.equal(
      PRODUCTION_SHAPE_LAB_ROSTER_HEADERS.at(-1),
      "Exp_x002e_GraduationSemester#Id",
    );
    const row0 = parsed.rows.find((row) => row.discordHandle === "synthetic.user.0");
    assert.ok(row0);
    assert.equal(row0.status, "Active");
    assert.deepEqual(row0.adaptRoleValues.sort(), ["TeamA", "TeamB"]);
    const row11 = parsed.rows.find((row) => row.discordHandle === "synthetic.user.11");
    assert.ok(row11);
    assert.deepEqual(row11.adaptRoleValues.sort(), ["TeamL", "TeamM"]);
    const row4 = parsed.rows.find((row) => row.discordHandle === "synthetic.user.4");
    assert.ok(row4);
    assert.equal(row4.status, "Inactive");
  });

  it("skips records with empty DiscordHandle or Status without rejecting the roster", () => {
    const lines: string[] = [];
    const originalLog = console.log;
    console.log = (line: string) => {
      lines.push(line);
    };
    let parsed: ReturnType<typeof parseLabRosterMessage>;
    try {
      parsed = parseLabRosterMessage(
        SYNTHETIC_LAB_ROSTER_EXPORT_PRODUCTION_SHAPE_WITH_SKIPPED_ROWS,
        "Subteam",
      );
    } finally {
      console.log = originalLog;
    }
    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }
    assert.equal(parsed.rows.length, 35);
    assert.equal(
      parsed.rows.some((row) => row.discordHandle === "synthetic.user.17"),
      false,
    );
    assert.ok(parsed.rows.some((row) => row.discordHandle === "synthetic.user.2"));
    const structural = lines.find((line) => line.includes("spacelabRosterParse"));
    assert.ok(structural);
    const payload = JSON.parse(structural!) as {
      spacelabRosterParse: {
        skipped_missing_discord_handle: number;
        rejectedRowReasons: { missing_github_handle: number };
      };
    };
    assert.equal(payload.spacelabRosterParse.skipped_missing_discord_handle, 1);
    assert.equal(
      payload.spacelabRosterParse.rejectedRowReasons.missing_github_handle,
      6,
    );
  });

  it("fails with roster_no_rows when every record is skipped", () => {
    const body = buildProductionShapeLabRosterExport({
      emptyDiscordHandleAt: Array.from({ length: 36 }, (_, index) => index),
    });
    const parsed = parseLabRosterMessage(body, "Subteam");
    assert.equal(parsed.ok, false);
    if (parsed.ok) {
      return;
    }
    assert.equal(parsed.reason, "roster_no_rows");
  });

  it("reports non-PII reasons when a message is not a roster export", () => {
    assert.equal(
      labRosterNotRecognizedReason("Hello team", "Subteam"),
      "missing_header DiscordHandle",
    );
    assert.equal(
      labRosterNotRecognizedReason(
        "DiscordHandle,Status,Other\nx,y,z",
        "Subteam",
      ),
      "column_missing Subteam",
    );
    assert.equal(
      labRosterNotRecognizedReason("<html><body>newsletter</body></html>", "Subteam"),
      "html_body",
    );
  });
});
