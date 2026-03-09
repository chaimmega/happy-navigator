/**
 * 02 — Loading states
 *
 * Tests that loading steps appear when a search is submitted and
 * disappear after results arrive.
 */

import { test, expect } from "@playwright/test";
import { mockNavigateSuccess, gotoHome, fillAddressForm } from "../helpers/mock";
import { THREE_ROUTES } from "../fixtures/api-responses";

test.describe("Loading states", () => {
  test("shows loading steps container after form submit", async ({ page }) => {
    // Use a delayed mock to catch the loading state
    let resolveRequest: (value: void) => void;
    const requestPending = new Promise<void>((res) => { resolveRequest = res; });

    await page.route("**/api/navigate", async (route) => {
      await requestPending;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(THREE_ROUTES),
      });
    });

    await gotoHome(page);
    await fillAddressForm(page, "Central Park", "Brooklyn Bridge");
    await page.getByTestId("btn-submit").click();

    // Loading steps should appear while request is pending
    await expect(page.getByTestId("loading-steps")).toBeVisible({ timeout: 5000 });

    // Unblock the request
    resolveRequest!();

    // Loading steps should disappear after results arrive
    await expect(page.getByTestId("loading-steps")).not.toBeVisible({ timeout: 15_000 });
  });

  test("individual loading steps are rendered inside loading container", async ({ page }) => {
    let resolveRequest: (value: void) => void;
    const requestPending = new Promise<void>((res) => { resolveRequest = res; });

    await page.route("**/api/navigate", async (route) => {
      await requestPending;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(THREE_ROUTES),
      });
    });

    await gotoHome(page);
    await fillAddressForm(page, "Central Park", "Brooklyn Bridge");
    await page.getByTestId("btn-submit").click();

    // Wait for loading container
    await expect(page.getByTestId("loading-steps")).toBeVisible({ timeout: 5000 });

    // At least the first step should be visible
    await expect(page.getByTestId("loading-step-0")).toBeVisible();

    resolveRequest!();
    // Wait for results to confirm loading ended
    await expect(page.getByTestId("route-card-0")).toBeVisible({ timeout: 15_000 });
  });

  test("submit button shows spinner text while loading", async ({ page }) => {
    let resolveRequest: (value: void) => void;
    const requestPending = new Promise<void>((res) => { resolveRequest = res; });

    await page.route("**/api/navigate", async (route) => {
      await requestPending;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(THREE_ROUTES),
      });
    });

    await gotoHome(page);
    await fillAddressForm(page, "Central Park", "Brooklyn Bridge");
    await page.getByTestId("btn-submit").click();

    // Submit button text should change to loading state
    await expect(page.getByTestId("btn-submit")).toContainText(/Finding Happy Routes/i, { timeout: 5000 });

    resolveRequest!();
    await expect(page.getByTestId("route-card-0")).toBeVisible({ timeout: 15_000 });
  });

  test("loading steps disappear after successful results load", async ({ page }) => {
    await mockNavigateSuccess(page, THREE_ROUTES);
    await gotoHome(page);
    await fillAddressForm(page, "Central Park", "Brooklyn Bridge");
    await page.getByTestId("btn-submit").click();

    // Wait for route cards — this means loading is done
    await expect(page.getByTestId("route-card-0")).toBeVisible({ timeout: 15_000 });
    // Loading steps should no longer be visible
    await expect(page.getByTestId("loading-steps")).not.toBeVisible();
  });
});
