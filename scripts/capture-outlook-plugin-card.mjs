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

async function captureOutlookCard(page, desktopPath, mobilePath) {
  await page.getByRole("tab", { name: "Plugins" }).click();
  await page.waitForSelector('[data-testid="plugins-table"]');
  await page.locator("#plugin-select").selectOption("spacelab-roster");
  await page.waitForSelector('[data-testid="plugin-outlook-mailbox-control"]');
  const card = page.getByTestId("plugin-config");
  if (desktopPath) {
    await card.screenshot({ path: desktopPath });
  }
  if (mobilePath) {
    await card.screenshot({ path: mobilePath });
  }
}

async function main() {
  fs.mkdirSync(artifactDir, { recursive: true });
  const env = {
    ...process.env,
    AUTH_SECRET: process.env.AUTH_SECRET ?? "dev-screenshot-secret-32chars!!",
    AUTH_URL: "http://127.0.0.1:3011",
    NEXT_PUBLIC_BASE_URL: "http://127.0.0.1:3011",
    NEXT_PUBLIC_DISCORD_CLIENT_ID: "000000000000000000",
    DISCORD_CLIENT_ID: "000000000000000000",
    DISCORD_CLIENT_SECRET: "dev",
    DATABASE_URL: "",
    MAIA_ENABLE_DEV_HELPERS: "1",
    MICROSOFT_CLIENT_ID: "dev-client",
    MICROSOFT_CLIENT_SECRET: "dev-secret",
  };

  const server = spawn("pnpm", ["exec", "next", "dev", "--port", "3011"], {
    cwd: path.join(root, "apps/dashboard"),
    env,
    stdio: "pipe",
  });

  try {
    await waitForServer("http://127.0.0.1:3011/api/health");
    const browser = await chromium.launch();
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const desktopPage = await desktopContext.newPage();
    await desktopContext.request.post("http://127.0.0.1:3011/api/dev/session");
    await desktopPage.goto("http://127.0.0.1:3011/servers/987654321098765432");
    await desktopPage.waitForSelector('[data-testid="manage-tabs"]');
    await captureOutlookCard(
      desktopPage,
      path.join(artifactDir, "outlook_plugin_card_desktop.png"),
      null,
    );

    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
    });
    const mobilePage = await mobileContext.newPage();
    await mobileContext.request.post("http://127.0.0.1:3011/api/dev/session");
    await mobilePage.goto("http://127.0.0.1:3011/servers/987654321098765432");
    await mobilePage.waitForSelector('[data-testid="manage-tabs"]');
    await captureOutlookCard(
      mobilePage,
      null,
      path.join(artifactDir, "outlook_plugin_card_mobile_390.png"),
    );
    await browser.close();
  } finally {
    server.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
