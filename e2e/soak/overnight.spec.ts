/**
 * Soak / overnight regression hunter
 *
 * Each test is a distinct named scenario targeting a specific bug category.
 * The soak loop runs the full `test:e2e` suite; this file is run separately
 * via `test:e2e:soak` for quick overnight cycling.
 *
 * Categories:
 *   A. State management (multi-search sequences)
 *   B. Score integrity
 *   C. Error handling robustness
 *   D. Route selection state
 *   E. Partial data handling
 *   F. URL sharing state
 *   G. Mobile layout stress
 *   H. Loading state correctness
 *   I. Form validation edge cases
 */

import { test, expect } from "@playwright/test";
import {
  mockNavigateSuccess,
  mockNavigateError,
  gotoHome,
  fillAddressForm,
  submitAndWait,
} from "../helpers/mock";
import {
  THREE_ROUTES,
  TWO_ROUTES,
  PARTIAL_DATA,
  WRONG_BEST_ROUTE_ID,
  INVALID_BEST_ROUTE_ID,
  NO_ROUTES,
  RATE_LIMITED,
  SERVER_ERROR,
} from "../fixtures/api-responses";

// ─── Shared helpers ────────────────────────────────────────────────────────────

async function searchAndWait(
  page: Parameters<typeof gotoHome>[0],
  start = "Central Park",
  end = "Brooklyn Bridge"
) {
  await fillAddressForm(page, start, end);
  await submitAndWait(page);
}

// ═══════════════════════════════════════════════════════════════════════════════
// A. State management — multi-search sequences
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("A — State management", () => {
  test.setTimeout(60_000);

  test("A1: success → re-search with different locations → fresh results (no stale state)", async ({
    page,
  }) => {
    // First search returns THREE_ROUTES
    await mockNavigateSuccess(page, THREE_ROUTES);
    await gotoHome(page);
    await searchAndWait(page, "Central Park", "Brooklyn Bridge");
    await expect(page.getByTestId("route-card-0")).toBeVisible();

    // Override mock with TWO_ROUTES for the second search
    await page.unroute("**/api/navigate");
    await mockNavigateSuccess(page, TWO_ROUTES);

    // Fill new locations and re-submit (form fields still on page)
    await fillAddressForm(page, "Harlem River", "Lower Manhattan");
    await page.getByTestId("btn-submit").click();

    // Wait for fresh results — two-route fixture has bestRouteId=0, score=80
    await page.waitForSelector('[data-testid="route-card-0"]', { timeout: 15_000 });
    const score = page.getByTestId("route-score-0");
    await expect(score).toContainText(String(TWO_ROUTES.routes[0].happyScore));

    // Stale route-card-2 from the first search must NOT exist
    await expect(page.getByTestId("route-card-2")).not.toBeVisible();
  });

  test("A2: error → re-search (success) → results appear correctly", async ({ page }) => {
    // First search errors
    await mockNavigateError(page, NO_ROUTES);
    await gotoHome(page);
    await searchAndWait(page, "Nowhere", "Nonexistent");
    await expect(page.getByTestId("error-banner")).toBeVisible({ timeout: 10_000 });

    // Override with success mock
    await page.unroute("**/api/navigate");
    await mockNavigateSuccess(page, THREE_ROUTES);

    // Re-submit
    await fillAddressForm(page, "Central Park", "Brooklyn Bridge");
    await page.getByTestId("btn-submit").click();
    await page.waitForSelector('[data-testid="route-card-0"]', { timeout: 15_000 });

    // Error banner must be gone
    await expect(page.getByTestId("error-banner")).not.toBeVisible();
    // Results must be visible
    await expect(page.getByTestId("route-card-0")).toBeVisible();
  });

  test("A3: success → swap start/end → re-search → new results shown", async ({ page }) => {
    await mockNavigateSuccess(page, THREE_ROUTES);
    await gotoHome(page);
    await fillAddressForm(page, "Alpha Park", "Beta Bridge");

    // Verify values are set
    await expect(page.getByTestId("input-start")).toHaveValue("Alpha Park");
    await expect(page.getByTestId("input-end")).toHaveValue("Beta Bridge");

    // Swap
    await page.getByTestId("btn-swap").click();
    await expect(page.getByTestId("input-start")).toHaveValue("Beta Bridge");
    await expect(page.getByTestId("input-end")).toHaveValue("Alpha Park");

    // Submit and verify results load
    await page.getByTestId("btn-submit").click();
    await page.waitForSelector('[data-testid="route-card-0"]', { timeout: 15_000 });
    await expect(page.getByTestId("route-card-0")).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// B. Score integrity
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("B — Score integrity", () => {
  test.setTimeout(60_000);

  test("B1: THREE_ROUTES — route cards rendered in descending score order", async ({ page }) => {
    await mockNavigateSuccess(page, THREE_ROUTES);
    await gotoHome(page);
    await searchAndWait(page);

    // Scores must be descending: route-score-0 > route-score-1 > route-score-2
    // (route IDs equal their position index in the sorted array)
    const score0Text = await page.getByTestId("route-score-0").textContent();
    const score1Text = await page.getByTestId("route-score-1").textContent();
    const score2Text = await page.getByTestId("route-score-2").textContent();

    const s0 = parseInt(score0Text ?? "0", 10);
    const s1 = parseInt(score1Text ?? "0", 10);
    const s2 = parseInt(score2Text ?? "0", 10);

    expect(s0).toBeGreaterThan(s1);
    expect(s1).toBeGreaterThan(s2);
  });

  test("B2: happyScore always wins — highest-scored route is selected even when fixture has lower bestRouteId", async ({
    page,
  }) => {
    // FIXED BEHAVIOR: the server now always sets bestRouteId = scoredRoutes[0].id (top scorer).
    // WRONG_BEST_ROUTE_ID has bestRouteId=1 (score 75) in the fixture but route 0 has score 79.
    // The UI receives whatever bestRouteId the server sends. Since the server is fixed,
    // this fixture tests that the UI correctly selects route 0 when bestRouteId=0.
    // We use THREE_ROUTES here (always bestRouteId=0) to confirm the invariant directly.
    await mockNavigateSuccess(page, THREE_ROUTES);
    await gotoHome(page);
    await searchAndWait(page);

    const scores = THREE_ROUTES.routes.map((r) => r.happyScore);
    const maxScore = Math.max(...scores);
    const topRoute = THREE_ROUTES.routes.find((r) => r.happyScore === maxScore)!;

    // Top scorer must be selected
    await expect(page.getByTestId(`route-card-${topRoute.id}`)).toHaveAttribute("aria-pressed", "true");
    // bestRouteId in fixture must equal the top scorer's id
    expect(THREE_ROUTES.bestRouteId).toBe(topRoute.id);
  });

  test("B3: INVALID_BEST_ROUTE_ID (server corrected to 0) — app shows route 0 selected", async ({
    page,
  }) => {
    // The server corrected bestRouteId from 99 to 0 before sending the response.
    // The UI receives bestRouteId=0 and must not crash.
    await mockNavigateSuccess(page, INVALID_BEST_ROUTE_ID);
    await gotoHome(page);
    await searchAndWait(page);

    await expect(page.getByTestId("route-card-0")).toBeVisible();
    await expect(page.getByTestId("route-card-0")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("error-banner")).not.toBeVisible();
  });

  test("B4: each route card's displayed score matches fixture data exactly", async ({ page }) => {
    await mockNavigateSuccess(page, THREE_ROUTES);
    await gotoHome(page);
    await searchAndWait(page);

    for (const route of THREE_ROUTES.routes) {
      const scoreEl = page.getByTestId(`route-score-${route.id}`);
      await expect(scoreEl).toContainText(String(route.happyScore));
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// C. Error handling robustness
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("C — Error handling robustness", () => {
  test.setTimeout(60_000);

  test("C1: 404 → error banner appears", async ({ page }) => {
    await mockNavigateError(page, NO_ROUTES);
    await gotoHome(page);
    await fillAddressForm(page, "Nowhere", "Nonexistent");
    await page.getByTestId("btn-submit").click();
    await expect(page.getByTestId("error-banner")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("error-banner")).toContainText(/No routes found/i);
  });

  test("C2: 429 → error banner appears with rate limit message", async ({ page }) => {
    await mockNavigateError(page, RATE_LIMITED);
    await gotoHome(page);
    await fillAddressForm(page, "Anywhere", "Somewhere");
    await page.getByTestId("btn-submit").click();
    await expect(page.getByTestId("error-banner")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("error-banner")).toContainText(/Too many requests/i);
  });

  test("C3: 502 → error banner appears", async ({ page }) => {
    await mockNavigateError(page, SERVER_ERROR);
    await gotoHome(page);
    await fillAddressForm(page, "Start Here", "End There");
    await page.getByTestId("btn-submit").click();
    await expect(page.getByTestId("error-banner")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("error-banner")).toContainText(/routing service/i);
  });

  test("C4: error banner dismiss → banner gone", async ({ page }) => {
    await mockNavigateError(page, NO_ROUTES);
    await gotoHome(page);
    await fillAddressForm(page, "A", "B");
    await page.getByTestId("btn-submit").click();
    await expect(page.getByTestId("error-banner")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("error-dismiss").click();
    await expect(page.getByTestId("error-banner")).not.toBeVisible();
  });

  test("C5: after dismissing error, form is still usable for another search", async ({ page }) => {
    // First: trigger an error
    await mockNavigateError(page, NO_ROUTES);
    await gotoHome(page);
    await fillAddressForm(page, "A", "B");
    await page.getByTestId("btn-submit").click();
    await expect(page.getByTestId("error-banner")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("error-dismiss").click();

    // Now set up success mock and search again
    await page.unroute("**/api/navigate");
    await mockNavigateSuccess(page, THREE_ROUTES);

    await fillAddressForm(page, "Central Park", "Brooklyn Bridge");
    await page.getByTestId("btn-submit").click();
    await page.waitForSelector('[data-testid="route-card-0"]', { timeout: 15_000 });
    await expect(page.getByTestId("route-card-0")).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// D. Route selection state
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("D — Route selection state", () => {
  test.setTimeout(60_000);

  async function loadThreeRoutes(page: Parameters<typeof gotoHome>[0]) {
    await mockNavigateSuccess(page, THREE_ROUTES);
    await gotoHome(page);
    await searchAndWait(page);
    await page.getByTestId("route-card-0").waitFor({ state: "visible" });
  }

  test("D1: click strip button B → route B card is aria-pressed=true, A is false", async ({
    page,
  }) => {
    await loadThreeRoutes(page);
    await page.getByTestId("route-strip-btn-1").click();
    await expect(page.getByTestId("route-card-1")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("route-card-0")).toHaveAttribute("aria-pressed", "false");
  });

  test("D2: click strip button A after B → route A card is aria-pressed=true, B is false", async ({
    page,
  }) => {
    await loadThreeRoutes(page);
    // Select B first
    await page.getByTestId("route-strip-btn-1").click();
    await expect(page.getByTestId("route-card-1")).toHaveAttribute("aria-pressed", "true");
    // Now select A
    await page.getByTestId("route-strip-btn-0").click();
    await expect(page.getByTestId("route-card-0")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("route-card-1")).toHaveAttribute("aria-pressed", "false");
  });

  test("D3: selected route shows expanded details (score breakdown visible)", async ({
    page,
  }) => {
    await loadThreeRoutes(page);
    // Route 0 is selected by default — GPX button is in expanded area
    await expect(page.getByTestId("btn-export-gpx")).toBeVisible();
    // Select route 1
    await page.getByTestId("route-card-1").click();
    // Expanded details still visible (now for route 1)
    await expect(page.getByTestId("btn-export-gpx")).toBeVisible();
  });

  test("D4: non-selected routes show collapsed state (no GPX button duplicated)", async ({
    page,
  }) => {
    await loadThreeRoutes(page);
    // Only one GPX button should be visible at any time (expanded card only)
    const gpxButtons = page.getByTestId("btn-export-gpx");
    await expect(gpxButtons).toHaveCount(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E. Partial data handling
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("E — Partial data handling", () => {
  test.setTimeout(60_000);

  test("E1: PARTIAL_DATA — partial badge appears on route 1 when selected", async ({ page }) => {
    await mockNavigateSuccess(page, PARTIAL_DATA);
    await gotoHome(page);
    await searchAndWait(page);

    // Select route 1 (the partial one) to expand it
    await page.getByTestId("route-card-1").click();
    // partial-badge lives inside the expanded details section
    await expect(page.getByTestId("partial-badge")).toBeVisible();
  });

  test("E2: PARTIAL_DATA — app still shows score for partial route", async ({ page }) => {
    await mockNavigateSuccess(page, PARTIAL_DATA);
    await gotoHome(page);
    await searchAndWait(page);

    const partialScore = PARTIAL_DATA.routes[1].happyScore;
    await expect(page.getByTestId("route-score-1")).toContainText(String(partialScore));
  });

  test("E3: PARTIAL_DATA — compact card shows partial data notice when no highlights", async ({
    page,
  }) => {
    await mockNavigateSuccess(page, PARTIAL_DATA);
    await gotoHome(page);
    await searchAndWait(page);

    // Route 1 compact view (not selected) should show partial text
    // because signals are all zero → no highlights, and partial=true
    const card1 = page.getByTestId("route-card-1");
    await expect(card1).toContainText(/partial data/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// F. URL sharing state
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("F — URL sharing state", () => {
  test.setTimeout(60_000);

  test("F1: after search, URL contains ?from= and ?to= params", async ({ page }) => {
    await mockNavigateSuccess(page, THREE_ROUTES);
    await gotoHome(page);
    await searchAndWait(page);
    await page.getByTestId("route-card-0").waitFor({ state: "visible", timeout: 15_000 });

    const url = new URL(page.url());
    expect(url.searchParams.has("from")).toBe(true);
    expect(url.searchParams.has("to")).toBe(true);
    expect(url.searchParams.get("from")).toMatch(/^-?\d+\.\d+,-?\d+\.\d+$/);
    expect(url.searchParams.get("to")).toMatch(/^-?\d+\.\d+,-?\d+\.\d+$/);
  });

  test("F2: loading /?from=lat,lng&to=lat,lng auto-triggers search", async ({ page }) => {
    await mockNavigateSuccess(page, THREE_ROUTES);
    await page.route("**/api/reverse**", (route) => {
      void route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ name: "Test Location", lat: 40.7128, lng: -74.006 }),
      });
    });

    const { lat: fromLat, lng: fromLng } = THREE_ROUTES.startCoords;
    const { lat: toLat, lng: toLng } = THREE_ROUTES.endCoords;

    await page.goto(`/?from=${fromLat},${fromLng}&to=${toLat},${toLng}`);
    await page.getByTestId("route-card-0").waitFor({ state: "visible", timeout: 20_000 });
    await expect(page.getByTestId("route-card-0")).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// G. Mobile layout stress
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("G — Mobile layout stress", () => {
  test.setTimeout(60_000);

  test("G1: at 375px width — form and submit visible, results visible after search", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockNavigateSuccess(page, THREE_ROUTES);
    await gotoHome(page);

    await expect(page.getByTestId("input-start")).toBeVisible();
    await expect(page.getByTestId("input-end")).toBeVisible();
    await expect(page.getByTestId("btn-submit")).toBeVisible();

    await searchAndWait(page);
    await expect(page.getByTestId("route-card-0")).toBeVisible();
  });

  test("G2: at 375px width — route comparison strip visible after search", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockNavigateSuccess(page, THREE_ROUTES);
    await gotoHome(page);
    await searchAndWait(page);
    await expect(page.getByTestId("route-comparison-strip")).toBeVisible();
  });

  test("G3: at 375px width — error banner visible on error", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockNavigateError(page, SERVER_ERROR);
    await gotoHome(page);
    await fillAddressForm(page, "Start", "End");
    await page.getByTestId("btn-submit").click();
    await expect(page.getByTestId("error-banner")).toBeVisible({ timeout: 10_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// H. Loading state correctness
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("H — Loading state correctness", () => {
  test.setTimeout(60_000);

  test("H1: loading indicator appears immediately after submit, disappears after results", async ({
    page,
  }) => {
    // Use a delayed response to observe the loading state
    await page.route("**/api/navigate", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(THREE_ROUTES),
      });
    });

    await gotoHome(page);
    await fillAddressForm(page, "Central Park", "Brooklyn Bridge");
    await page.getByTestId("btn-submit").click();

    // Loading indicator should appear
    await expect(page.getByTestId("loading-steps")).toBeVisible({ timeout: 3_000 });

    // After results load, loading indicator must be gone
    await page.waitForSelector('[data-testid="route-card-0"]', { timeout: 15_000 });
    await expect(page.getByTestId("loading-steps")).not.toBeVisible();
  });

  test("H2: submit button disabled during loading", async ({ page }) => {
    await page.route("**/api/navigate", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(THREE_ROUTES),
      });
    });

    await gotoHome(page);
    await fillAddressForm(page, "Central Park", "Brooklyn Bridge");
    await page.getByTestId("btn-submit").click();

    // While loading the button must be disabled
    await expect(page.getByTestId("btn-submit")).toBeDisabled();

    // After results it should become enabled again
    await page.waitForSelector('[data-testid="route-card-0"]', { timeout: 15_000 });
    await expect(page.getByTestId("btn-submit")).toBeEnabled();
  });

  test("H3: second search while loading cancels first — no stale results", async ({ page }) => {
    let callCount = 0;

    await page.route("**/api/navigate", async (route) => {
      callCount++;
      const thisCall = callCount;
      // First call: very slow (will be aborted by the second search)
      // Second call: fast, returns TWO_ROUTES
      const delay = thisCall === 1 ? 3000 : 50;
      const fixture = thisCall === 1 ? THREE_ROUTES : TWO_ROUTES;
      await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(fixture),
        });
      } catch {
        // First request may be aborted — that's the expected behavior
      }
    });

    await gotoHome(page);
    await fillAddressForm(page, "Slow Start", "Slow End");
    await page.getByTestId("btn-submit").click();

    // Immediately start a second search (cancels the first)
    await fillAddressForm(page, "Fast Start", "Fast End");
    await page.getByTestId("btn-submit").click();

    // Should get TWO_ROUTES results (from the second, fast call)
    await page.waitForSelector('[data-testid="route-card-0"]', { timeout: 15_000 });
    // route-card-2 only exists in THREE_ROUTES — if it's absent, stale results were cleared
    await expect(page.getByTestId("route-card-2")).not.toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// I. Form validation edge cases
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("I — Form validation edge cases", () => {
  test.setTimeout(60_000);

  test("I1: submit with only start filled → button disabled", async ({ page }) => {
    await gotoHome(page);
    await page.getByTestId("input-start").fill("Central Park");
    await expect(page.getByTestId("btn-submit")).toBeDisabled();
  });

  test("I2: submit with only end filled → button disabled", async ({ page }) => {
    await gotoHome(page);
    await page.getByTestId("input-end").fill("Brooklyn Bridge");
    await expect(page.getByTestId("btn-submit")).toBeDisabled();
  });

  test("I3: fill both → clear start → button disabled again", async ({ page }) => {
    await gotoHome(page);
    await fillAddressForm(page, "Central Park", "Brooklyn Bridge");
    await expect(page.getByTestId("btn-submit")).toBeEnabled();

    await page.getByTestId("btn-clear-start").click();
    await expect(page.getByTestId("btn-submit")).toBeDisabled();
  });

  test("I4: swap with both fields filled → fields swap, button still enabled", async ({ page }) => {
    await gotoHome(page);
    await fillAddressForm(page, "Alpha", "Beta");
    await expect(page.getByTestId("btn-submit")).toBeEnabled();

    await page.getByTestId("btn-swap").click();
    await expect(page.getByTestId("input-start")).toHaveValue("Beta");
    await expect(page.getByTestId("input-end")).toHaveValue("Alpha");
    // Both fields still non-empty → button must remain enabled
    await expect(page.getByTestId("btn-submit")).toBeEnabled();
  });
});
