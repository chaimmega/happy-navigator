import type { Page, Route } from "@playwright/test";
import type { NavigateResponse } from "../../app/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ErrorResponse {
  status: number;
  body: { error: string };
}

// ─── Mock POST /api/navigate ───────────────────────────────────────────────────

/**
 * Intercept POST /api/navigate and return a canned fixture.
 * Call before page.goto() to ensure the intercept is in place.
 */
export async function mockNavigateSuccess(
  page: Page,
  fixture: NavigateResponse
): Promise<void> {
  await page.route("**/api/navigate", (route: Route) => {
    void route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fixture),
    });
  });
}

export async function mockNavigateError(
  page: Page,
  fixture: ErrorResponse
): Promise<void> {
  await page.route("**/api/navigate", (route: Route) => {
    void route.fulfill({
      status: fixture.status,
      contentType: "application/json",
      body: JSON.stringify(fixture.body),
    });
  });
}

// ─── Mock GET /api/reverse ─────────────────────────────────────────────────────

export async function mockReverse(
  page: Page,
  name = "Test Location"
): Promise<void> {
  await page.route("**/api/reverse**", (route: Route) => {
    const url = new URL(route.request().url());
    const lat = url.searchParams.get("lat") ?? "40.7128";
    const lng = url.searchParams.get("lng") ?? "-74.0060";
    void route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ name, lat: parseFloat(lat), lng: parseFloat(lng) }),
    });
  });
}

// ─── Common page setup ─────────────────────────────────────────────────────────

/**
 * Navigate to the home page and wait for it to be interactive.
 * Does NOT wait for the map — Google Maps JS API may not load in tests.
 */
export async function gotoHome(page: Page): Promise<void> {
  await page.goto("/");
  // Wait for the submit button to appear (form is the key interactive element)
  await page.waitForSelector('[data-testid="btn-submit"]', { timeout: 15_000 });
}

/**
 * Fill the address-mode form fields with plain text (no autocomplete needed).
 * This simulates typing without triggering Google Places.
 */
export async function fillAddressForm(
  page: Page,
  start: string,
  end: string
): Promise<void> {
  // Ensure we're in address mode
  const tabAddress = page.getByTestId("tab-address");
  if (await tabAddress.isVisible()) {
    await tabAddress.click();
  }

  // Fill start input
  const startInput = page.getByTestId("input-start");
  await startInput.click();
  await startInput.fill(start);

  // Fill end input
  const endInput = page.getByTestId("input-end");
  await endInput.click();
  await endInput.fill(end);
}

/**
 * Submit the form and wait for either results or an error banner to appear.
 */
export async function submitAndWait(page: Page): Promise<void> {
  await page.getByTestId("btn-submit").click();
  // Wait for loading to start then stop, or error banner
  await page.waitForSelector(
    '[data-testid="route-card-0"], [data-testid="error-banner"]',
    { timeout: 30_000 }
  );
}
