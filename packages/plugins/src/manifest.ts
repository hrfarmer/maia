export const PLUGIN_MANIFEST_FILENAME = "maia.plugin.json";

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
}

export class PluginManifestError extends Error {
  readonly code = "PLUGIN_MANIFEST_ERROR" as const;

  constructor(message: string) {
    super(message);
    this.name = "PluginManifestError";
  }
}

const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const PLUGIN_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function requireNonEmptyString(
  value: unknown,
  field: string,
): string | PluginManifestError {
  if (typeof value !== "string") {
    return new PluginManifestError(`${field} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return new PluginManifestError(`${field} is required`);
  }
  return trimmed;
}

export function parsePluginManifest(raw: unknown): PluginManifest {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new PluginManifestError("manifest must be a JSON object");
  }

  const record = raw as Record<string, unknown>;
  const idResult = requireNonEmptyString(record.id, "id");
  if (idResult instanceof PluginManifestError) {
    throw idResult;
  }
  if (!PLUGIN_ID_PATTERN.test(idResult)) {
    throw new PluginManifestError(
      "id must start with a lowercase letter and contain only lowercase letters, digits, and hyphens",
    );
  }

  const nameResult = requireNonEmptyString(record.name, "name");
  if (nameResult instanceof PluginManifestError) {
    throw nameResult;
  }

  const versionResult = requireNonEmptyString(record.version, "version");
  if (versionResult instanceof PluginManifestError) {
    throw versionResult;
  }
  if (!PLUGIN_VERSION_PATTERN.test(versionResult)) {
    throw new PluginManifestError("version must be semver like 1.0.0");
  }

  return {
    id: idResult,
    name: nameResult,
    version: versionResult,
  };
}
