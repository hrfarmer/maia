import type { DiscoverPluginsOptions } from "./discover.js";

export function validManifest(overrides: Record<string, unknown> = {}) {
  return {
    id: "demo",
    name: "Demo plugin",
    lifetime: "always-on",
    subscribedEvents: ["member.join"],
    command: ["node", "index.js"],
    environment: [],
    ...overrides,
  };
}

export function mockDiscoverFs(input: {
  pluginsDir?: string;
  directories?: string[];
  files?: Map<string, string>;
  unreadable?: Set<string>;
}): DiscoverPluginsOptions {
  const directories = new Set(input.directories ?? []);
  const files = input.files ?? new Map<string, string>();
  const unreadable = input.unreadable ?? new Set<string>();

  return {
    pluginsDir: input.pluginsDir ?? "/plugins",
    readdir: async () => [
      ...(input.directories ?? []),
      "loose-file.txt",
    ],
    stat: async (target) => {
      const path = String(target);
      const name = path.split("/").pop() ?? "";
      if (name === "loose-file.txt") {
        return { isDirectory: () => false };
      }
      return { isDirectory: () => directories.has(name) };
    },
    readFile: async (target) => {
      const path = String(target);
      if (unreadable.has(path)) {
        const error = new Error("permission denied") as NodeJS.ErrnoException;
        error.code = "EACCES";
        throw error;
      }
      const content = files.get(path);
      if (content === undefined) {
        const error = new Error("missing") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      }
      return content;
    },
  };
}
