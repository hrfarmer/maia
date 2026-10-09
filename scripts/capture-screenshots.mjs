import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const artifactDir = "/opt/cursor/artifacts";
const root = path.resolve(import.meta.dirname, "..");

async function waitForServer(url, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Server did not become ready");
}

async function main() {
  fs.mkdirSync(artifactDir, { recursive: true });

  const env = {
    ...process.env,
    AUTH_SECRET: process.env.AUTH_SECRET ?? "dev-screenshot-secret-32chars!!",
    AUTH_URL: "http://127.0.0.1:3000",
    NEXT_PUBLIC_BASE_URL: "http://127.0.0.1:3000",
    NEXT_PUBLIC_DISCORD_CLIENT_ID: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? "000000000000000000",
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID ?? "000000000000000000",
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET ?? "dev",
    DATABASE_URL:
      process.env.DATABASE_URL ??
      "postgresql://maia:maia@127.0.0.1:5432/maia",
    MAIA_ENABLE_DEV_HELPERS: "1",
  };

  const server = spawn("pnpm", ["--filter", "@maia/dashboard", "dev"], {
    cwd: root,
    env,
    stdio: "inherit",
  });

  try {
    await waitForServer("http://127.0.0.1:3000/api/health");

    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    await page.goto("http://127.0.0.1:3000/");
    await page.screenshot({
      path: path.join(artifactDir, "screenshot_login.png"),
      fullPage: true,
    });

    await context.request.post("http://127.0.0.1:3000/api/dev/session");
    await page.goto("http://127.0.0.1:3000/servers");
    await page.waitForSelector(".server-list");
    await page.screenshot({
      path: path.join(artifactDir, "screenshot_server_list.png"),
      fullPage: true,
    });

    await page.goto("http://127.0.0.1:3000/servers/987654321098765432");
    await page.waitForSelector(".command-list");
    await page.screenshot({
      path: path.join(artifactDir, "screenshot_server_detail.png"),
      fullPage: true,
    });

    await browser.close();
  } finally {
    server.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
