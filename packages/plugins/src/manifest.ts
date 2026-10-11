import {
  INVOCATION_FORBIDDEN_EVENTS,
  isKnownPluginEvent,
} from "./events.js";

export const PLUGIN_MANIFEST_FILENAME = "maia-plugin.json";

export const RESERVED_ENV_KEYS = new Set([
  "MAIA_PLUGIN_TOKEN",
  "MAIA_PLUGIN_URL",
]);

export type PluginLifetime = "invocation" | "always-on";

export const DEFAULT_MAX_CONCURRENT_INVOCATIONS = 8;

export interface PluginEnvironmentKey {
  key: string;
  required: boolean;
  secret: boolean;
}

export interface PluginManifest {
  id: string;
  name: string;
  lifetime: PluginLifetime;
  subscribedEvents: string[];
  command: string[];
  environment: PluginEnvironmentKey[];
  /** Required for invocation plugins; unused for always-on. */
  invocationTimeLimitMs: number | null;
  /** Invocation-only cap for concurrent member/role event processes; default 8. */
  maxConcurrentInvocations: number | null;
}

export class PluginManifestError extends Error {
  readonly code = "PLUGIN_MANIFEST_ERROR" as const;

  constructor(message: string) {
    super(message);
    this.name = "PluginManifestError";
  }
}

const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new PluginManifestError(`${field} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new PluginManifestError(`${field} is required`);
  }
  return trimmed;
}

function parseLifetime(value: unknown): PluginLifetime {
  if (value !== "invocation" && value !== "always-on") {
    throw new PluginManifestError(
      'lifetime must be "invocation" or "always-on"',
    );
  }
  return value;
}

function parseCommand(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new PluginManifestError("command is required");
  }
  const command: string[] = [];
  for (const part of value) {
    if (typeof part !== "string" || part.trim().length === 0) {
      throw new PluginManifestError("command must be a non-empty array of strings");
    }
    command.push(part);
  }
  return command;
}

function parseSubscribedEvents(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new PluginManifestError("subscribedEvents must be an array");
  }
  const events: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new PluginManifestError(
        "subscribedEvents must contain non-empty strings",
      );
    }
    if (!isKnownPluginEvent(item)) {
      throw new PluginManifestError(`unknown event: ${item}`);
    }
    events.push(item);
  }
  return events;
}

function parseMaxConcurrentInvocations(
  value: unknown,
  lifetime: PluginLifetime,
): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (lifetime === "always-on") {
    throw new PluginManifestError(
      "maxConcurrentInvocations applies only to invocation plugins",
    );
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new PluginManifestError(
      "maxConcurrentInvocations must be a positive integer",
    );
  }
  return value;
}

function parseInvocationTimeLimitMs(
  value: unknown,
  lifetime: PluginLifetime,
): number | null {
  if (lifetime === "always-on") {
    if (value !== undefined && value !== null) {
      throw new PluginManifestError(
        "invocationTimeLimitMs applies only to invocation plugins",
      );
    }
    return null;
  }
  if (value === undefined || value === null) {
    throw new PluginManifestError(
      "invocationTimeLimitMs is required for invocation plugins",
    );
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new PluginManifestError(
      "invocationTimeLimitMs must be a positive integer",
    );
  }
  return value;
}

function parseEnvironment(value: unknown): PluginEnvironmentKey[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new PluginManifestError("environment must be an array");
  }
  const keys: PluginEnvironmentKey[] = [];
  for (const item of value) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new PluginManifestError("environment entries must be objects");
    }
    const record = item as Record<string, unknown>;
    const key = requireNonEmptyString(record.key, "environment.key");
    if (RESERVED_ENV_KEYS.has(key)) {
      throw new PluginManifestError(
        `environment must not define reserved key ${key}`,
      );
    }
    keys.push({
      key,
      required: record.required === true,
      secret: record.secret === true,
    });
  }
  return keys;
}

export function parsePluginManifest(raw: unknown): PluginManifest {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new PluginManifestError("manifest must be a JSON object");
  }

  const record = raw as Record<string, unknown>;
  const id = requireNonEmptyString(record.id, "id");
  if (!PLUGIN_ID_PATTERN.test(id)) {
    throw new PluginManifestError(
      "id must start with a lowercase letter and contain only lowercase letters, digits, and hyphens",
    );
  }

  const name = requireNonEmptyString(record.name, "name");
  const lifetime = parseLifetime(record.lifetime);
  const subscribedEvents = parseSubscribedEvents(record.subscribedEvents);
  const command = parseCommand(record.command);
  const environment = parseEnvironment(record.environment);
  const invocationTimeLimitMs = parseInvocationTimeLimitMs(
    record.invocationTimeLimitMs,
    lifetime,
  );
  const maxConcurrentInvocations = parseMaxConcurrentInvocations(
    record.maxConcurrentInvocations,
    lifetime,
  );

  if (
    lifetime === "invocation" &&
    subscribedEvents.some((event) => INVOCATION_FORBIDDEN_EVENTS.has(event))
  ) {
    throw new PluginManifestError(
      "invocation plugins cannot subscribe to message or reaction events",
    );
  }

  return {
    id,
    name,
    lifetime,
    subscribedEvents,
    command,
    environment,
    invocationTimeLimitMs,
    maxConcurrentInvocations,
  };
}

export const PLUGIN_ID_CLASH_ERROR = "Plugin id clash";
