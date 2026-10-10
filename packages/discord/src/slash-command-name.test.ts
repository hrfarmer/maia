import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  validateSlashCommandDescription,
  validateSlashCommandName,
  validateSlashCommandResponse,
} from "./slash-command-name.js";

describe("validateSlashCommandName", () => {
  it("accepts valid names", () => {
    const result = validateSlashCommandName("My_Command-1");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.name, "my_command-1");
    }
  });

  it("rejects built-in collisions", () => {
    const result = validateSlashCommandName("hello");
    assert.equal(result.ok, false);
  });

  it("rejects invalid characters", () => {
    const result = validateSlashCommandName("bad name!");
    assert.equal(result.ok, false);
  });
});

describe("validateSlashCommandDescription", () => {
  it("requires non-empty description", () => {
    assert.equal(validateSlashCommandDescription("  ").ok, false);
  });
});

describe("validateSlashCommandResponse", () => {
  it("enforces max length", () => {
    const result = validateSlashCommandResponse("x".repeat(2001));
    assert.equal(result.ok, false);
  });
});
