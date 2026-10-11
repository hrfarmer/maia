import path from "node:path";

/** Default plugins directory inside the bot Docker image. */
export const DEFAULT_DOCKER_PLUGINS_DIR = "/app/plugins";

export function resolvePluginsDirectory(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = env.MAIA_PLUGINS_DIR?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  if (env.MAIA_DOCKER === "1" || env.NODE_ENV === "production") {
    return DEFAULT_DOCKER_PLUGINS_DIR;
  }
  return path.resolve(process.cwd(), "plugins");
}
