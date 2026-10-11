import fs from "node:fs";
import { chromium } from "playwright";

const DEV_GUILD_ID = "987654321098765432";
const base = "http://localhost:3000";
const outDesktop = "/opt/cursor/artifacts/screenshots/spacelab-adapt-roles-desktop.png";
const outMobile = "/opt/cursor/artifacts/screenshots/spacelab-adapt-roles-390px.png";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

await context.request.post(`${base}/api/dev/session`);
await page.goto(`${base}/servers/${DEV_GUILD_ID}`);
await page.getByRole("tab", { name: "Plugins" }).click();
await page.locator("#plugin-select").selectOption("spacelab-roster");
await page.getByTestId("adapt-role-row-Alpha").waitFor({ state: "visible" });
await page.screenshot({ path: outDesktop, fullPage: true });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/servers/${DEV_GUILD_ID}`);
await page.getByRole("tab", { name: "Plugins" }).click();
await page.locator("#plugin-select").selectOption("spacelab-roster");
await page.getByTestId("adapt-role-row-Alpha").waitFor({ state: "visible" });
await page.screenshot({ path: outMobile, fullPage: true });

await browser.close();
for (const path of [outDesktop, outMobile]) {
  if (!fs.existsSync(path)) {
    throw new Error(`Missing screenshot ${path}`);
  }
}
console.log(outDesktop);
console.log(outMobile);
