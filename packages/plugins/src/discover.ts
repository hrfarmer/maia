import fs from "node:fs/promises";
import path from "node:path";
import {
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
  errorMessage: string | null;
}

export interface DiscoverPluginsOptions {
  pluginsDir?: string;
  readFile?: typeof fs.readFile;
  readdir?: typeof fs.readdir;
  stat?: typeof fs.stat;
}

async function isDirectory(
  statFn: typeof fs.stat,
  fullPath: string,
): Promise<boolean> {
  try {
    const info = await statFn(fullPath);
    return info.isDirectory();
  } catch {
    return false;
  }
}

export async function discoverPlugins(
  options: DiscoverPluginsOptions = {},
): Promise<DiscoveredPluginEntry[]> {
  const pluginsDir = options.pluginsDir ?? resolvePluginsDirectory();
  const readFile = options.readFile ?? fs.readFile;
  const readdir = options.readdir ?? fs.readdir;
  const stat = options.stat ?? fs.stat;

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
      const rawText = await readFile(manifestPath, "utf8");
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        results.push({
          directoryName,
          status: "error",
          manifest: null,
          errorMessage: `${PLUGIN_MANIFEST_FILENAME} is not valid JSON`,
        });
        continue;
      }
      try {
        const manifest = parsePluginManifest(parsed);
        results.push({
          directoryName,
          status: "ok",
          manifest,
          errorMessage: null,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Invalid plugin manifest";
        results.push({
          directoryName,
          status: "error",
          manifest: null,
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
        errorMessage: message,
      });
    }
  }

  return results;
}
