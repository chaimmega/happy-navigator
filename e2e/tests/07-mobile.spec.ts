/**
 * 07 — Mobile viewport
 *
 * Tests that key UI elements are visible and functional on a mobile viewport.
 * This test file is run with the "mobile" Playwright project (Pixel 5 viewport).
 */

import { test, expect } from "@playwright/test";
import {
  mockNavigateSuccess,
  gotoHome,
  fillAddressForm,
  submitAndWait,
} from "../helpers/mock";
import { THREE_ROUTES } from "../fixtures/api-responses";

test.describe("Mobile viewport", () => {
  test("search form is visible on mobile", async ({ page }) => {
    await gotoHome(page);
    await expect(page.getByTestId("tab-address")).toBeVisible();
    await expect(page.getByTestId("input-start")).toBeVisible();
    await expect(page.getByTestId("input-end")).toBeVisible();
    await expect(page.getByTestId("btn-submit")).toBeVisible();
  });

  test("submit button is visible and in viewport on mobile", async ({ page }) => {
    await gotoHome(page);
    const btn = page.getByTestId("btn-submit");
    await expect(btn).toBeVisible();
    // Ensure it's actually in the viewport
    await expect(btn).toBeInViewport();
  });

  test("results render on mobile after successful search", async ({ page }) => {
    await mockNavigateSuccess(page, THREE_ROUTES);
    await gotoHome(page);
    await fillAddressForm(page, "Central Park", "Brooklyn Bridge");
    await submitAndWait(page);

    await expect(page.getByTestId("route-card-0")).toBeVisible();
  });

  test("route comparison strip is visible on mobile", async ({ page }) => {
    await mockNavigateSuccess(page, THREE_ROUTES);
    await gotoHome(page);
    await fillAddressForm(page, "Central Park", "Brooklyn Bridge");
    await submitAndWait(page);

    await expect(page.getByTestId("route-comparison-strip")).toBeVisible();
  });

  test("map container is present below results on mobile", async ({ page }) => {
    await mockNavigateSuccess(page, THREE_ROUTES);
    await gotoHome(page);
    await fillAddressForm(page, "Central Park", "Brooklyn Bridge");
    await submitAndWait(page);

    const mapContainer = page.getByTestId("map-container");
    await expect(mapContainer).toBeAttached();
    // On mobile the layout is flex-col, map is below sidebar
    // It may not be in viewport without scrolling — just verify it exists in DOM
  });

  test("error banner is visible on mobile on error", async ({ page }) => {
    await page.route("**/api/navigate", (route) => {
      void route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "No routes found between these locations." }),
      });
    });
    await gotoHome(page);
    await fillAddressForm(page, "NoPlace", "AlsoNoPlace");
    await page.getByTestId("btn-submit").click();
    await expect(page.getByTestId("error-banner")).toBeVisible({ timeout: 10_000 });
  });

  test("swap button is visible and functional on mobile", async ({ page }) => {
    await gotoHome(page);
    await page.getByTestId("input-start").fill("Alpha");
    await page.getByTestId("input-end").fill("Beta");
    await page.getByTestId("btn-swap").click();
    await expect(page.getByTestId("input-start")).toHaveValue("Beta");
    await expect(page.getByTestId("input-end")).toHaveValue("Alpha");
  });
});
