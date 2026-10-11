import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decryptWithAuthSecret,
  encryptWithAuthSecret,
} from "./auth-secret-crypto.js";

describe("auth-secret crypto", () => {
  it("round-trips a refresh token with AUTH_SECRET", () => {
    const secret = "test-auth-secret-at-least-32-characters";
    const encrypted = encryptWithAuthSecret("refresh-token-value", secret);
    assert.notEqual(encrypted, "refresh-token-value");
    assert.equal(decryptWithAuthSecret(encrypted, secret), "refresh-token-value");
  });

  it("rejects decryption with a different secret", () => {
    const encrypted = encryptWithAuthSecret("token", "secret-one-32-characters-minimum!!");
    assert.throws(() =>
      decryptWithAuthSecret(encrypted, "secret-two-32-characters-minimum!!"),
    );
  });
});
