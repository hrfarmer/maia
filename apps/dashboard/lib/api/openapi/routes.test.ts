import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import {
  buildOpenApiDocument,
  listOpenApiPathOperations,
} from "./document";

const API_V1_ROOT = path.join(
  import.meta.dirname,
  "../../../app/api/v1",
);

async function collectRouteFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectRouteFiles(fullPath)));
    } else if (entry.isFile() && entry.name === "route.ts") {
      files.push(fullPath);
    }
  }
  return files;
}

function filePathToOpenApiPath(routeFile: string): string {
  const relative = path.relative(API_V1_ROOT, path.dirname(routeFile));
  const segments = relative.split(path.sep).filter(Boolean);
  const openApiSegments = segments.map((segment) =>
    segment.startsWith("[") && segment.endsWith("]")
      ? `{${segment.slice(1, -1)}}`
      : segment,
  );
  return `/api/v1/${openApiSegments.join("/")}`;
}

async function readRouteMethods(routeFile: string): Promise<Set<string>> {
  const source = await readFile(routeFile, "utf8");
  const methods = new Set<string>();
  const pattern = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g;
  for (const match of source.matchAll(pattern)) {
    methods.add(match[1]!);
  }
  return methods;
}

describe("OpenAPI coverage for /api/v1 routes", () => {
  it("documents every app/api/v1 route and HTTP method", async () => {
    const spec = listOpenApiPathOperations(
      buildOpenApiDocument("https://example.test"),
    );
    const routeFiles = await collectRouteFiles(API_V1_ROOT);
    assert.ok(routeFiles.length > 0, "expected at least one /api/v1 route");

    for (const routeFile of routeFiles) {
      const openApiPath = filePathToOpenApiPath(routeFile);
      const specMethods = spec.get(openApiPath);
      assert.ok(
        specMethods,
        `OpenAPI spec missing path ${openApiPath} (from ${routeFile})`,
      );

      const routeMethods = await readRouteMethods(routeFile);
      for (const method of routeMethods) {
        assert.ok(
          specMethods.has(method),
          `${method} ${openApiPath} is not documented in OpenAPI`,
        );
      }

      for (const method of specMethods) {
        assert.ok(
          routeMethods.has(method),
          `OpenAPI documents ${method} ${openApiPath} but route file does not export it`,
        );
      }
    }

    for (const documentedPath of spec.keys()) {
      assert.ok(
        documentedPath.startsWith("/api/v1/guilds/{guildId}"),
        `unexpected OpenAPI path outside guild API: ${documentedPath}`,
      );
    }
  });

  it("includes standard auth and rate-limit error responses", () => {
    const document = buildOpenApiDocument("https://example.test");
    const sample = document.paths["/api/v1/guilds/{guildId}/roles"]?.get;
    assert.ok(sample);
    const responses = sample.responses as Record<string, unknown>;
    for (const status of ["401", "403", "429", "400", "500"]) {
      assert.ok(
        responses[status],
        `GET /roles should document ${status} responses`,
      );
    }
    assert.ok(document.components.securitySchemes.bearerAuth);
    assert.match(document.info.description, /120/);
  });
});
