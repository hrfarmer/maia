import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { apiKeyMatchesGuild, parseBearerAuth } from "./auth-utils";

describe("parseBearerAuth", () => {
  it("returns null when header missing", () => {
    assert.equal(parseBearerAuth(null), null);
  });

  it("returns null for non-bearer schemes", () => {
    assert.equal(parseBearerAuth("Basic abc"), null);
  });

  it("extracts bearer token", () => {
    assert.equal(parseBearerAuth("Bearer maia_test"), "maia_test");
  });

  it("rejects empty bearer token", () => {
    assert.equal(parseBearerAuth("Bearer "), null);
  });
});

describe("apiKeyMatchesGuild", () => {
  it("accepts matching guild ids", () => {
    assert.equal(apiKeyMatchesGuild("123", "123"), true);
  });

  it("rejects mismatched guild ids", () => {
    assert.equal(apiKeyMatchesGuild("123", "456"), false);
  });
});
