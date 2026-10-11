import fs from "node:fs/promises";
import path from "node:path";
import { resolvePluginsDirectory } from "./paths.js";

export const SPACELAB_PLUGINS_DIRECTORY_NAME = "spacelab-plugins";
export const SPACELAB_ROSTER_PLUGIN_ID = "spacelab-roster";

export function resolveShippedSpacelabPluginsSource(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): string | null {
  const configured = env.MAIA_SHIPPED_PLUGINS_DIR?.trim();
  if (configured) {
    return path.join(
      path.resolve(configured),
      SPACELAB_PLUGINS_DIRECTORY_NAME,
    );
  }
  return path.join(
    path.resolve(cwd, "shipped-plugins"),
    SPACELAB_PLUGINS_DIRECTORY_NAME,
  );
}

export interface SyncShippedSpacelabPluginResult {
  synced: boolean;
  reason?: "source-missing" | "source-not-configured";
  destination?: string;
}

export interface SyncShippedSpacelabPluginOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  rm?: typeof fs.rm;
  cp?: typeof fs.cp;
  access?: typeof fs.access;
}

export async function syncShippedSpacelabPlugin(
  options: SyncShippedSpacelabPluginOptions = {},
): Promise<SyncShippedSpacelabPluginResult> {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const rm = options.rm ?? fs.rm.bind(fs);
  const cp = options.cp ?? fs.cp.bind(fs);
  const access = options.access ?? fs.access.bind(fs);

  const source = resolveShippedSpacelabPluginsSource(env, cwd);
  if (!source) {
    return { synced: false, reason: "source-not-configured" };
  }

  try {
    await access(source);
  } catch {
    return { synced: false, reason: "source-missing" };
  }

  const destination = path.join(
    resolvePluginsDirectory(env, cwd),
    SPACELAB_PLUGINS_DIRECTORY_NAME,
  );

  await rm(destination, { recursive: true, force: true });
  await cp(source, destination, { recursive: true });

  return { synced: true, destination };
}
