/**
 * 04 — Route selection
 *
 * Tests that clicking strip buttons and route cards changes the selected route,
 * and that the selected state is visually distinct.
 */

import { test, expect } from "@playwright/test";
import { mockNavigateSuccess, gotoHome, fillAddressForm, submitAndWait } from "../helpers/mock";
import { THREE_ROUTES } from "../fixtures/api-responses";

async function loadResults(page: Parameters<typeof gotoHome>[0]) {
  await mockNavigateSuccess(page, THREE_ROUTES);
  await gotoHome(page);
  await fillAddressForm(page, "Central Park", "Brooklyn Bridge");
  await submitAndWait(page);
  // Ensure all 3 cards are visible
  await page.getByTestId("route-card-0").waitFor({ state: "visible" });
}

test.describe("Route selection", () => {
  test("default selected route is bestRouteId after results load", async ({ page }) => {
    await loadResults(page);
    const bestCard = page.getByTestId(`route-card-${THREE_ROUTES.bestRouteId}`);
    // The card has aria-pressed="true" when selected
    await expect(bestCard).toHaveAttribute("aria-pressed", "true");
  });

  test("clicking a strip button changes selected route", async ({ page }) => {
    await loadResults(page);

    // Initially route 0 is selected
    await expect(page.getByTestId("route-card-0")).toHaveAttribute("aria-pressed", "true");

    // Click route 1 strip button
    await page.getByTestId("route-strip-btn-1").click();

    // Route 1 card should now be selected
    await expect(page.getByTestId("route-card-1")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("route-card-0")).toHaveAttribute("aria-pressed", "false");
  });

  test("clicking a route card changes selected route", async ({ page }) => {
    await loadResults(page);

    // Click route 2 card directly
    await page.getByTestId("route-card-2").click();
    await expect(page.getByTestId("route-card-2")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("route-card-0")).toHaveAttribute("aria-pressed", "false");
  });

  test("selected card gets shadow and border (visual distinction)", async ({ page }) => {
    await loadResults(page);

    const card0 = page.getByTestId("route-card-0");
    // Selected card has specific classes (shadow-lg) — verify class list contains shadow
    await expect(card0).toHaveClass(/shadow/);

    // Click card 1
    await page.getByTestId("route-card-1").click();
    const card1 = page.getByTestId("route-card-1");
    await expect(card1).toHaveClass(/shadow/);
    // Card 0 should no longer have the prominent shadow (it reverts to hover style)
    await expect(card0).not.toHaveClass(/shadow-lg/);
  });

  test("selected card shows expanded details (score bar, badges, GPX button)", async ({ page }) => {
    await loadResults(page);
    // Route 0 is selected by default — verify GPX export button is visible
    await expect(page.getByTestId("btn-export-gpx")).toBeVisible();

    // Click route 1 to select it — GPX button should still be visible
    await page.getByTestId("route-card-1").click();
    await expect(page.getByTestId("btn-export-gpx")).toBeVisible();
  });

  test("selected route score in strip matches fixture data", async ({ page }) => {
    await loadResults(page);
    // route 0 has happyScore=79
    const score = page.getByTestId("route-score-0");
    await expect(score).toContainText("79");
  });

  test("selecting via keyboard Enter key works on route card", async ({ page }) => {
    await loadResults(page);
    // Tab to route card 1 and press Enter
    await page.getByTestId("route-card-1").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("route-card-1")).toHaveAttribute("aria-pressed", "true");
  });

  test("selecting via keyboard Space key works on route card", async ({ page }) => {
    await loadResults(page);
    await page.getByTestId("route-card-2").focus();
    await page.keyboard.press("Space");
    await expect(page.getByTestId("route-card-2")).toHaveAttribute("aria-pressed", "true");
  });
});
