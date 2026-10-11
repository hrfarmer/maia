import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

describe("#38 .env.example documentation", () => {
  it("documents Microsoft OAuth vars and bot AUTH_SECRET for token decryption", () => {
    const envExample = fs.readFileSync(
      path.join(repoRoot, ".env.example"),
      "utf8",
    );
    assert.match(envExample, /^MICROSOFT_CLIENT_ID=/m);
    assert.match(envExample, /^MICROSOFT_CLIENT_SECRET=/m);
    assert.match(envExample, /^AUTH_SECRET=/m);
    assert.match(
      envExample,
      /Bot worker needs AUTH_SECRET.*decrypt stored refresh tokens/s,
    );
  });
});
