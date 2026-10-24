// Renders public/icons/*.png from scripts/icon.svg using the preinstalled Playwright Chromium.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH ?? "playwright");
import fs from "node:fs";
const svg = fs.readFileSync(new URL("./icon.svg", import.meta.url), "utf8");
const out = new URL("../public/icons/", import.meta.url);
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, pad] of [["icon-192.png", 192, 0], ["icon-512.png", 512, 0], ["icon-maskable-512.png", 512, 0.12], ["apple-touch-icon.png", 180, 0]]) {
  await page.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * (1 - pad * 2));
  await page.setContent(`<body style="margin:0;background:#0b0908;display:grid;place-items:center;width:${size}px;height:${size}px">${svg.replace("<svg ", `<svg width="${inner}" height="${inner}" `)}</body>`);
  await page.screenshot({ path: new URL(name, out).pathname, omitBackground: false });
}
await browser.close();
console.log("icons written");
