/**
 * 09 — URL sharing
 *
 * Tests that:
 * 1. After a successful search, the URL updates with ?from=&to= params
 * 2. Loading the page with ?from=&to= auto-triggers a search
 */

import { test, expect } from "@playwright/test";
import { mockNavigateSuccess, mockReverse } from "../helpers/mock";
import { THREE_ROUTES } from "../fixtures/api-responses";

test.describe("URL sharing", () => {
  test("URL updates with ?from= and ?to= after successful search", async ({ page }) => {
    await mockNavigateSuccess(page, THREE_ROUTES);

    await page.goto("/");
    await page.waitForSelector('[data-testid="btn-submit"]');

    await page.getByTestId("input-start").fill("Central Park");
    await page.getByTestId("input-end").fill("Brooklyn Bridge");
    await page.getByTestId("btn-submit").click();

    // Wait for results to appear
    await page.getByTestId("route-card-0").waitFor({ state: "visible", timeout: 15_000 });

    // URL should now have ?from= and ?to= params
    const url = new URL(page.url());
    expect(url.searchParams.has("from")).toBe(true);
    expect(url.searchParams.has("to")).toBe(true);

    // Values should be lat,lng pairs
    const from = url.searchParams.get("from")!;
    const to = url.searchParams.get("to")!;
    expect(from).toMatch(/^-?\d+\.\d+,-?\d+\.\d+$/);
    expect(to).toMatch(/^-?\d+\.\d+,-?\d+\.\d+$/);
  });

  test("URL params from fixture match the fixture's startCoords and endCoords", async ({ page }) => {
    await mockNavigateSuccess(page, THREE_ROUTES);
    await page.goto("/");
    await page.waitForSelector('[data-testid="btn-submit"]');

    await page.getByTestId("input-start").fill("Central Park");
    await page.getByTestId("input-end").fill("Brooklyn Bridge");
    await page.getByTestId("btn-submit").click();

    await page.getByTestId("route-card-0").waitFor({ state: "visible", timeout: 15_000 });

    const url = new URL(page.url());
    const from = url.searchParams.get("from")!;
    const to = url.searchParams.get("to")!;

    const [fromLat, fromLng] = from.split(",").map(Number);
    const [toLat, toLng] = to.split(",").map(Number);

    // Coords should match the fixture's startCoords/endCoords
    expect(fromLat).toBeCloseTo(THREE_ROUTES.startCoords.lat, 4);
    expect(fromLng).toBeCloseTo(THREE_ROUTES.startCoords.lng, 4);
    expect(toLat).toBeCloseTo(THREE_ROUTES.endCoords.lat, 4);
    expect(toLng).toBeCloseTo(THREE_ROUTES.endCoords.lng, 4);
  });

  test("loading page with ?from=&to= URL params auto-triggers search", async ({ page }) => {
    // Set up the navigate mock BEFORE navigating to the URL
    await mockNavigateSuccess(page, THREE_ROUTES);
    await mockReverse(page, "Test Location");

    const { lat: fromLat, lng: fromLng } = THREE_ROUTES.startCoords;
    const { lat: toLat, lng: toLng } = THREE_ROUTES.endCoords;

    // Navigate directly to the URL with params — this should auto-trigger a search
    await page.goto(`/?from=${fromLat},${fromLng}&to=${toLat},${toLng}`);

    // Results should appear automatically without any user interaction
    await page.getByTestId("route-card-0").waitFor({ state: "visible", timeout: 20_000 });
  });

  test("invalid URL params are ignored (no auto-search)", async ({ page }) => {
    // Navigate with non-numeric params — should not trigger a search
    let searchCalled = false;
    await page.route("**/api/navigate", (route) => {
      searchCalled = true;
      void route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(THREE_ROUTES),
      });
    });

    await page.goto("/?from=bad&to=data");
    await page.waitForSelector('[data-testid="btn-submit"]');

    // Wait a moment to confirm no auto-search happened
    await page.waitForTimeout(1000);
    expect(searchCalled).toBe(false);
    // Error banner should NOT appear (invalid params are silently ignored)
    await expect(page.getByTestId("error-banner")).not.toBeVisible();
  });

  test("missing URL params result in normal idle state", async ({ page }) => {
    let searchCalled = false;
    await page.route("**/api/navigate", (route) => {
      searchCalled = true;
      void route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(THREE_ROUTES),
      });
    });

    await page.goto("/");
    await page.waitForSelector('[data-testid="btn-submit"]');
    await page.waitForTimeout(500);

    expect(searchCalled).toBe(false);
    // Idle state should show the form
    await expect(page.getByTestId("btn-submit")).toBeVisible();
  });
});
