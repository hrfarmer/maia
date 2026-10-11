import path from "node:path";

export function resolvePluginsDirectory(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): string {
  const configured = env.MAIA_PLUGINS_DIR?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  return path.resolve(cwd, "plugins");
}
