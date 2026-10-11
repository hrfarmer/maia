import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { discoverPlugins } from "./discover.js";

describe("discoverPlugins", () => {
  it("returns ok entries for valid plugin folders and errors for invalid ones", async () => {
    const files = new Map<string, string>([
      [
        "/plugins/good/maia.plugin.json",
        JSON.stringify({ id: "good", name: "Good", version: "1.0.0" }),
      ],
    ]);

    const entries = await discoverPlugins({
      pluginsDir: "/plugins",
      readdir: async () => ["good", "bad", ".hidden", "file.txt"],
      stat: async (target) => {
        const path = String(target);
        if (path.endsWith("file.txt")) {
          return { isDirectory: () => false } as Awaited<
            ReturnType<typeof import("node:fs/promises").stat>
          >;
        }
        return { isDirectory: () => true } as Awaited<
          ReturnType<typeof import("node:fs/promises").stat>
        >;
      },
      readFile: async (target) => {
        const path = String(target);
        const content = files.get(path);
        if (content === undefined) {
          const error = new Error("missing") as NodeJS.ErrnoException;
          error.code = "ENOENT";
          throw error;
        }
        return content;
      },
    });

    assert.deepEqual(entries, [
      {
        directoryName: "bad",
        status: "error",
        manifest: null,
        errorMessage: "Missing maia.plugin.json",
      },
      {
        directoryName: "good",
        status: "ok",
        manifest: { id: "good", name: "Good", version: "1.0.0" },
        errorMessage: null,
      },
    ]);
  });
});
