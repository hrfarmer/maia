export function serializeDiscordPayload(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => serializeDiscordPayload(entry));
  }
  const record = value as Record<string, unknown>;
  if (typeof record.toJSON === "function") {
    return record.toJSON();
  }
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(record)) {
    out[key] = serializeDiscordPayload(entry);
  }
  return out;
}
