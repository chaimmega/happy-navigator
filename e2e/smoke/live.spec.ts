/**
 * Live smoke test — uses real APIs
 *
 * Run with: npm run test:e2e:smoke
 *
 * This test hits the real /api/navigate endpoint with known stable locations.
 * It verifies that the full pipeline returns results (any routes, any score).
 *
 * IMPORTANT: Requires a running dev server with valid API keys in .env.local.
 * Set SMOKE_TEST=1 to opt-in to running this test; it is skipped otherwise.
 */

import { test, expect } from "@playwright/test";

const SKIP_LIVE = !process.env.SMOKE_TEST;

test.describe("Live smoke — real API", () => {
  test.skip(SKIP_LIVE, "Set SMOKE_TEST=1 to run live smoke tests");

  test("search between known stable locations returns results", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('[data-testid="btn-submit"]');

    // Use Central Park to Brooklyn Bridge — reliable NYC route
    await page.getByTestId("input-start").fill("Central Park, New York, NY");
    await page.getByTestId("input-end").fill("Brooklyn Bridge, New York, NY");
    await page.getByTestId("btn-submit").click();

    // Allow up to 30 seconds for the full real pipeline
    await page.waitForSelector(
      '[data-testid="route-card-0"], [data-testid="error-banner"]',
      { timeout: 35_000 }
    );

    // Should have results (not an error)
    const hasResults = await page.getByTestId("route-card-0").isVisible();
    const hasError = await page.getByTestId("error-banner").isVisible();

    // Take a screenshot for debugging
    await page.screenshot({ path: "playwright-report/smoke-live.png", fullPage: false });

    expect(hasError).toBe(false);
    expect(hasResults).toBe(true);
  });

  test("results have at least one route with a Happy Score > 0", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('[data-testid="btn-submit"]');

    await page.getByTestId("input-start").fill("Central Park, New York, NY");
    await page.getByTestId("input-end").fill("Brooklyn Bridge, New York, NY");
    await page.getByTestId("btn-submit").click();

    await page.getByTestId("route-card-0").waitFor({ state: "visible", timeout: 35_000 });

    // The first strip score should show a number > 0
    const score0 = page.getByTestId("route-score-0");
    const scoreText = await score0.textContent();
    const scoreNum = parseInt(scoreText?.trim() ?? "0", 10);
    expect(scoreNum).toBeGreaterThan(0);
  });
});
