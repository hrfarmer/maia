import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CustomCommandValidationError,
  parseCustomCommandEphemeral,
} from "./validation";

describe("parseCustomCommandEphemeral", () => {
  it("returns undefined when omitted", () => {
    assert.equal(parseCustomCommandEphemeral(undefined), undefined);
  });

  it("accepts boolean values", () => {
    assert.equal(parseCustomCommandEphemeral(false), false);
    assert.equal(parseCustomCommandEphemeral(true), true);
  });

  it("rejects non-boolean values", () => {
    assert.throws(
      () => parseCustomCommandEphemeral("true"),
      (error: unknown) =>
        error instanceof CustomCommandValidationError &&
        error.message === "ephemeral must be a boolean",
    );
  });
});
