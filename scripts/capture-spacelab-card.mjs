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

async function captureSpacelabCard(page, outputPath) {
  await page.getByRole("tab", { name: "Plugins" }).click();
  await page.waitForSelector('[data-testid="plugins-table"]');
  await page.locator("#plugin-select").selectOption("spacelab-roster");
  await page.waitForSelector('[data-testid="plugin-config"]');
  await page.waitForSelector('[data-testid="spacelab-cycle-status"]');
  await page.waitForSelector('[data-testid="spacelab-adapt-roles"]');
  await page.getByTestId("spacelab-last-cycle").waitFor({ timeout: 15_000 });
  await page.getByTestId("plugin-config").screenshot({ path: outputPath });
}

async function main() {
  fs.mkdirSync(artifactDir, { recursive: true });
  const env = {
    ...process.env,
    AUTH_SECRET: process.env.AUTH_SECRET ?? "dev-screenshot-secret-32chars!!",
    AUTH_URL: "http://127.0.0.1:3011",
    NEXT_PUBLIC_BASE_URL: "http://127.0.0.1:3011",
    NEXT_PUBLIC_DISCORD_CLIENT_ID:
      process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? "000000000000000000",
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID ?? "000000000000000000",
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET ?? "dev",
    DATABASE_URL: process.env.DATABASE_URL ?? "",
    MAIA_ENABLE_DEV_HELPERS: "1",
  };

  const server = spawn("pnpm", ["exec", "next", "dev", "--port", "3011"], {
    cwd: path.join(root, "apps/dashboard"),
    env,
    stdio: "inherit",
  });

  try {
    await waitForServer("http://127.0.0.1:3011/api/health");
    const browser = await chromium.launch();
    const desktop = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: "dark",
    });
    const desktopPage = await desktop.newPage();
    await desktop.request.post("http://127.0.0.1:3011/api/dev/session");
    await desktopPage.goto("http://127.0.0.1:3011/servers/987654321098765432");
    await captureSpacelabCard(
      desktopPage,
      path.join(artifactDir, "spacelab_plugins_card_desktop.png"),
    );

    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      colorScheme: "dark",
    });
    const mobilePage = await mobile.newPage();
    await mobile.request.post("http://127.0.0.1:3011/api/dev/session");
    await mobilePage.goto("http://127.0.0.1:3011/servers/987654321098765432");
    await captureSpacelabCard(
      mobilePage,
      path.join(artifactDir, "spacelab_plugins_card_mobile_390.png"),
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
