import puppeteer from "puppeteer";
import path from "path";

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 860 });

// ── 1. Initial / idle state ──────────────────────────────────────────────────
await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: "scripts/shot-1-idle.png", fullPage: false });
console.log("✓ shot-1-idle.png");

// ── 2. Fill in search form ───────────────────────────────────────────────────
await page.type('input[placeholder="e.g. Central Park, New York"]', "Vondelpark, Amsterdam");
await page.type('input[placeholder="e.g. Brooklyn Bridge, New York"]', "Rijksmuseum, Amsterdam");
await page.screenshot({ path: "scripts/shot-2-form-filled.png", fullPage: false });
console.log("✓ shot-2-form-filled.png");

// ── 3. Submit and wait (up to 40s) for results ──────────────────────────────
await page.click('button[type="submit"]');

// Show the loading state
await new Promise(r => setTimeout(r, 2000));
await page.screenshot({ path: "scripts/shot-3-loading.png", fullPage: false });
console.log("✓ shot-3-loading.png");

// Wait for results (RoutePanel appears)
try {
  await page.waitForSelector('[aria-pressed]', { timeout: 40000 });
  await new Promise(r => setTimeout(r, 1500)); // let map render
  await page.screenshot({ path: "scripts/shot-4-results.png", fullPage: false });
  console.log("✓ shot-4-results.png");

  // ── 4. Click Route B to show selection change ──────────────────────────────
  const routeButtons = await page.$$('[aria-pressed]');
  if (routeButtons[1]) {
    await routeButtons[1].click();
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: "scripts/shot-5-route-b.png", fullPage: false });
    console.log("✓ shot-5-route-b.png");
  }
} catch {
  console.log("⚠ results timed out (API key may be missing) — saving current state");
  await page.screenshot({ path: "scripts/shot-4-results.png", fullPage: false });
}

await browser.close();
console.log("Done.");
