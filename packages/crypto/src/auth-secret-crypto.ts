import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const VERSION_PREFIX = "v1:";

function deriveKey(authSecret: string): Buffer {
  return createHash("sha256").update(authSecret, "utf8").digest();
}

export function getAuthSecretForCrypto(): string {
  const secret = process.env.AUTH_SECRET ?? "";
  if (!secret) {
    throw new Error("AUTH_SECRET is required for token encryption");
  }
  return secret;
}

export function encryptWithAuthSecret(
  plaintext: string,
  authSecret: string = getAuthSecretForCrypto(),
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(authSecret), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${VERSION_PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptWithAuthSecret(
  payload: string,
  authSecret: string = getAuthSecretForCrypto(),
): string {
  if (!payload.startsWith(VERSION_PREFIX)) {
    throw new Error("Unsupported encrypted payload version");
  }
  const body = payload.slice(VERSION_PREFIX.length);
  const [ivPart, tagPart, dataPart] = body.split(".");
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("Malformed encrypted payload");
  }
  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const data = Buffer.from(dataPart, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(authSecret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}
