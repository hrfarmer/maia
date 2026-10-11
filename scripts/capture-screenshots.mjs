import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const artifactDir = "/opt/cursor/artifacts";
const root = path.resolve(import.meta.dirname, "..");

const hideDevUiInitScript = () => {
  const selectors =
    "nextjs-portal, [data-nextjs-toast], #devtools-indicator, [data-next-badge-root]";
  const hide = () => {
    document.querySelectorAll(selectors).forEach((el) => {
      el.remove();
    });
  };
  hide();
  new MutationObserver(hide).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
};

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

async function captureCustomCommandsTab(page, outputPath) {
  await page.getByRole("tab", { name: "Custom commands" }).click();
  await page.waitForSelector('[data-testid="custom-commands-table"]');
  await page.getByText("/rules").waitFor({ timeout: 15_000 });
  await page.screenshot({
    path: outputPath,
    fullPage: true,
  });
}

async function capturePluginsTab(page, outputPath) {
  await page.getByRole("tab", { name: "Plugins" }).click();
  await page.waitForSelector('[data-testid="plugins-table"]');
  await page.getByRole("cell", { name: "Welcome bot", exact: true }).waitFor({
    timeout: 15_000,
  });
  await page.getByRole("cell", { name: "Role sync", exact: true }).waitFor({
    timeout: 15_000,
  });
  await page.getByText("Missing maia-plugin.json").waitFor({ timeout: 15_000 });
  await page.locator("#plugin-select").selectOption("role-sync");
  await page.waitForSelector('[data-testid="plugin-config"]');
  await page.getByLabel("WEBHOOK_URL *").waitFor({ timeout: 15_000 });
  await page.getByTestId("run-plugin-now").waitFor({ timeout: 15_000 });
  await page.getByTestId("plugin-cron-control").waitFor({ timeout: 15_000 });
  await page.screenshot({
    path: outputPath,
    fullPage: true,
  });
}

async function capturePluginCronControl(page, desktopPath, mobilePath) {
  await page.getByRole("tab", { name: "Plugins" }).click();
  await page.waitForSelector('[data-testid="plugins-table"]');
  await page.locator("#plugin-select").selectOption("role-sync");
  await page.waitForSelector('[data-testid="plugin-cron-control"]');
  const cron = page.getByTestId("plugin-cron-control");
  if (desktopPath) {
    await cron.screenshot({ path: desktopPath });
  }
  if (mobilePath) {
    await cron.screenshot({ path: mobilePath });
  }
}

async function main() {
  fs.mkdirSync(artifactDir, { recursive: true });

  const env = {
    ...process.env,
    AUTH_SECRET: process.env.AUTH_SECRET ?? "dev-screenshot-secret-32chars!!",
    AUTH_URL: "http://127.0.0.1:3010",
    NEXT_PUBLIC_BASE_URL: "http://127.0.0.1:3010",
    NEXT_PUBLIC_DISCORD_CLIENT_ID:
      process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? "000000000000000000",
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
      colorScheme: "dark",
    });
    await desktopContext.addInitScript(hideDevUiInitScript);
    const desktopPage = await desktopContext.newPage();
    await desktopContext.request.post("http://127.0.0.1:3010/api/dev/session");
    await desktopPage.goto("http://127.0.0.1:3010/servers/987654321098765432");
    await desktopPage.waitForSelector('[data-testid="server-list"]');
    const sidebarState = await desktopPage
      .locator('[data-slot="sidebar"]')
      .getAttribute("data-state");
    if (sidebarState === "collapsed") {
      await desktopPage.locator('[data-sidebar="trigger"]').first().click();
      await desktopPage.waitForSelector(
        '[data-slot="sidebar"][data-state="expanded"]',
      );
    }
    await desktopPage.screenshot({
      path: path.join(artifactDir, "screenshot_desktop_sidebar_expanded.png"),
      fullPage: false,
    });

    await desktopPage.locator('[data-sidebar="trigger"]').first().click();
    await desktopPage.waitForSelector(
      '[data-slot="sidebar"][data-state="collapsed"]',
    );
    await desktopPage.waitForTimeout(400);
    await desktopPage.screenshot({
      path: path.join(artifactDir, "screenshot_desktop_sidebar_collapsed.png"),
      fullPage: false,
    });

    await captureCustomCommandsTab(
      desktopPage,
      path.join(artifactDir, "screenshot_custom_commands_desktop.png"),
    );

    await capturePluginsTab(
      desktopPage,
      path.join(artifactDir, "screenshot_plugins_desktop.png"),
    );
    await capturePluginCronControl(
      desktopPage,
      path.join(artifactDir, "screenshot_plugin_cron_desktop.png"),
      null,
    );

    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      colorScheme: "dark",
    });
    await mobileContext.addInitScript(hideDevUiInitScript);
    const mobilePage = await mobileContext.newPage();
    await mobileContext.request.post("http://127.0.0.1:3010/api/dev/session");
    await mobilePage.goto("http://127.0.0.1:3010/servers/987654321098765432", {
      waitUntil: "networkidle",
    });
    await mobilePage.waitForSelector('[data-testid="manage-tabs"]');
    await captureCustomCommandsTab(
      mobilePage,
      path.join(artifactDir, "screenshot_custom_commands_mobile.png"),
    );

    await capturePluginsTab(
      mobilePage,
      path.join(artifactDir, "screenshot_plugins_mobile_390.png"),
    );
    await capturePluginCronControl(
      mobilePage,
      null,
      path.join(artifactDir, "screenshot_plugin_cron_mobile_390.png"),
    );

    await mobilePage.waitForTimeout(500);
    await mobilePage
      .locator("header")
      .getByRole("button", { name: "Toggle Sidebar" })
      .click();
    const sheet = mobilePage.locator('[role="dialog"][data-mobile="true"]');
    await sheet.waitFor({ state: "visible" });
    await mobilePage.waitForSelector('[data-testid="server-list"]');
    await mobilePage.waitForFunction(() => {
      const el = document.querySelector('[role="dialog"][data-mobile="true"]');
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const transform = getComputedStyle(el).transform;
      return (
        rect.width >= 100 &&
        rect.x >= -2 &&
        (transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)")
      );
    });
    await mobilePage.screenshot({
      path: path.join(artifactDir, "screenshot_mobile_sidebar_open.png"),
      fullPage: false,
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
