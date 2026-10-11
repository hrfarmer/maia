import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  apiKeyAuditActor,
  apiKeyMatchesGuild,
  parseBearerAuth,
} from "./auth-utils";

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

describe("apiKeyAuditActor", () => {
  it("names the API key in audit rows", () => {
    assert.deepEqual(apiKeyAuditActor({ id: "key-1", name: "Automation" }), {
      source: "api",
      id: "key-1",
      label: "Automation",
    });
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
