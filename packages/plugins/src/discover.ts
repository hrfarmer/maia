import fs from "node:fs/promises";
import path from "node:path";
import {
  PLUGIN_ID_CLASH_ERROR,
  PLUGIN_MANIFEST_FILENAME,
  parsePluginManifest,
  type PluginManifest,
} from "./manifest.js";
import { resolvePluginsDirectory } from "./paths.js";

export type DiscoveredPluginStatus = "ok" | "error";

export interface DiscoveredPluginEntry {
  directoryName: string;
  status: DiscoveredPluginStatus;
  manifest: PluginManifest | null;
  pluginId: string | null;
  errorMessage: string | null;
}

export interface DiscoverPluginsOptions {
  pluginsDir?: string;
  readFile?: (path: string) => Promise<string>;
  readdir?: (path: string) => Promise<string[]>;
  stat?: (path: string) => Promise<{ isDirectory(): boolean }>;
}

async function isDirectory(
  statFn: (path: string) => Promise<{ isDirectory(): boolean }>,
  fullPath: string,
): Promise<boolean> {
  try {
    const info = await statFn(fullPath);
    return info.isDirectory();
  } catch {
    return false;
  }
}

function applyPluginIdClashes(entries: DiscoveredPluginEntry[]) {
  const byId = new Map<string, DiscoveredPluginEntry[]>();
  for (const entry of entries) {
    if (!entry.pluginId) {
      continue;
    }
    const group = byId.get(entry.pluginId) ?? [];
    group.push(entry);
    byId.set(entry.pluginId, group);
  }

  for (const [pluginId, group] of byId) {
    if (group.length < 2) {
      continue;
    }
    for (const entry of group) {
      entry.status = "error";
      entry.manifest = null;
      entry.errorMessage = `${PLUGIN_ID_CLASH_ERROR}: ${pluginId}`;
    }
  }
}

export async function discoverPlugins(
  options: DiscoverPluginsOptions = {},
): Promise<DiscoveredPluginEntry[]> {
  const pluginsDir = options.pluginsDir ?? resolvePluginsDirectory();
  const readFile =
    options.readFile ??
    (async (filePath: string) => fs.readFile(filePath, "utf8"));
  const readdir =
    options.readdir ?? (async (dirPath: string) => fs.readdir(dirPath));
  const stat =
    options.stat ??
    (async (filePath: string) => fs.stat(filePath));

  let entries: string[];
  try {
    entries = await readdir(pluginsDir);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to read plugins directory";
    throw new Error(`Failed to scan plugins directory (${pluginsDir}): ${message}`);
  }

  const directories = (
    await Promise.all(
      entries
        .filter((name) => !name.startsWith("."))
        .map(async (name) => {
          const fullPath = path.join(pluginsDir, name);
          return (await isDirectory(stat, fullPath)) ? name : null;
        }),
    )
  ).filter((name): name is string => name !== null);

  directories.sort((a, b) => a.localeCompare(b));

  const results: DiscoveredPluginEntry[] = [];
  for (const directoryName of directories) {
    const manifestPath = path.join(
      pluginsDir,
      directoryName,
      PLUGIN_MANIFEST_FILENAME,
    );
    try {
      const rawText = await readFile(manifestPath);
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        results.push({
          directoryName,
          status: "error",
          manifest: null,
          pluginId: null,
          errorMessage: `${PLUGIN_MANIFEST_FILENAME} is not valid JSON`,
        });
        continue;
      }

      let pluginId: string | null = null;
      if (
        parsed !== null &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        typeof (parsed as Record<string, unknown>).id === "string"
      ) {
        pluginId = (parsed as Record<string, string>).id;
      }

      try {
        const manifest = parsePluginManifest(parsed);
        results.push({
          directoryName,
          status: "ok",
          manifest,
          pluginId: manifest.id,
          errorMessage: null,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Invalid plugin manifest";
        results.push({
          directoryName,
          status: "error",
          manifest: null,
          pluginId,
          errorMessage: message,
        });
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        results.push({
          directoryName,
          status: "error",
          manifest: null,
          pluginId: null,
          errorMessage: `Missing ${PLUGIN_MANIFEST_FILENAME}`,
        });
        continue;
      }
      const message =
        error instanceof Error ? error.message : "Unable to read manifest";
      results.push({
        directoryName,
        status: "error",
        manifest: null,
        pluginId: null,
        errorMessage: message,
      });
    }
  }

  applyPluginIdClashes(results);
  return results;
}
