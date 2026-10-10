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
    AUTH_URL: "http://127.0.0.1:3010",
    NEXT_PUBLIC_BASE_URL: "http://127.0.0.1:3010",
    NEXT_PUBLIC_DISCORD_CLIENT_ID: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? "000000000000000000",
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID ?? "000000000000000000",
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET ?? "dev",
    DATABASE_URL: process.env.DATABASE_URL ?? "",
    MAIA_ENABLE_DEV_HELPERS: "1",
  };

  const server = spawn("pnpm", ["exec", "next", "dev", "--port", "3010"], {
    cwd: path.join(root, "apps/dashboard"),
    env,
    stdio: "inherit",
  });

  try {
    await waitForServer("http://127.0.0.1:3010/api/health");

    const browser = await chromium.launch();

    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const desktopPage = await desktopContext.newPage();
    await desktopContext.request.post("http://127.0.0.1:3010/api/dev/session");
    await desktopPage.goto("http://127.0.0.1:3010/servers");
    await desktopPage.waitForSelector('[data-testid="server-list"]');
    await desktopPage.screenshot({
      path: path.join(artifactDir, "screenshot_desktop_sidebar_expanded.png"),
      fullPage: true,
    });

    await desktopPage.goto("http://127.0.0.1:3010/servers/987654321098765432");
    await desktopPage.waitForSelector('[data-testid="manage-tabs"]');
    await desktopPage.screenshot({
      path: path.join(artifactDir, "screenshot_desktop_server_tabs.png"),
      fullPage: true,
    });

    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
    });
    const mobilePage = await mobileContext.newPage();
    await mobileContext.request.post("http://127.0.0.1:3010/api/dev/session");
    await mobilePage.goto("http://127.0.0.1:3010/servers/987654321098765432");
    await mobilePage.waitForSelector('[data-testid="manage-tabs"]');
    await mobilePage.screenshot({
      path: path.join(artifactDir, "screenshot_mobile_sidebar_closed.png"),
      fullPage: true,
    });

    await mobilePage.getByRole("button", { name: "Toggle Sidebar" }).click();
    await mobilePage.waitForSelector('[data-testid="server-list"]');
    await mobilePage.screenshot({
      path: path.join(artifactDir, "screenshot_mobile_sidebar_open.png"),
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
