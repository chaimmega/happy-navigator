/**
 * 03 — Results rendering
 *
 * Tests that after a successful search the results panel renders correctly,
 * and that error states are handled and dismissible.
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
  NO_ROUTES,
  RATE_LIMITED,
  SERVER_ERROR,
  SINGLE_ROUTE,
} from "../fixtures/api-responses";

// ─── Helper: run a full search cycle with a given fixture ─────────────────────

async function runSearch(
  page: Parameters<typeof gotoHome>[0],
  fixture: Parameters<typeof mockNavigateSuccess>[1]
) {
  await mockNavigateSuccess(page, fixture);
  await gotoHome(page);
  await fillAddressForm(page, "Central Park, New York", "Brooklyn Bridge, New York");
  await submitAndWait(page);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Results rendering", () => {
  test("AI summary card appears with bullet points", async ({ page }) => {
    await runSearch(page, THREE_ROUTES);
    const summary = page.getByTestId("ai-summary");
    await expect(summary).toBeVisible();
    // Should have at least 2 list items
    const bullets = summary.getByRole("listitem");
    await expect(bullets).toHaveCount(THREE_ROUTES.explanation!.bullets.length);
  });

  test("route comparison strip shows all routes (3-route case)", async ({ page }) => {
    await runSearch(page, THREE_ROUTES);
    await expect(page.getByTestId("route-comparison-strip")).toBeVisible();
    // Strip should have 3 buttons
    for (let i = 0; i < 3; i++) {
      await expect(page.getByTestId(`route-strip-btn-${i}`)).toBeVisible();
    }
  });

  test("route comparison strip hidden for single route", async ({ page }) => {
    await runSearch(page, SINGLE_ROUTE);
    // ComparisonStrip returns null when routes.length < 2
    await expect(page.getByTestId("route-comparison-strip")).not.toBeVisible();
  });

  test("route cards are rendered for each route", async ({ page }) => {
    await runSearch(page, THREE_ROUTES);
    for (let i = 0; i < 3; i++) {
      await expect(page.getByTestId(`route-card-${i}`)).toBeVisible();
    }
  });

  test("route cards show distance and time text", async ({ page }) => {
    await runSearch(page, THREE_ROUTES);
    // All route cards should contain some distance text (mi or km)
    for (let i = 0; i < 3; i++) {
      const card = page.getByTestId(`route-card-${i}`);
      await expect(card).toContainText(/(mi|km)/);
      await expect(card).toContainText(/(min|h)/);
    }
  });

  test("best route card shows 'Best Route' label", async ({ page }) => {
    await runSearch(page, THREE_ROUTES);
    // bestRouteId = 0, so route-card-0 should have the Best Route label
    const bestCard = page.getByTestId("route-card-0");
    await expect(bestCard).toContainText(/Best Route/i);
  });

  test("strip button for best route shows 'Happiest' label", async ({ page }) => {
    await runSearch(page, THREE_ROUTES);
    const bestStripBtn = page.getByTestId(`route-strip-btn-${THREE_ROUTES.bestRouteId}`);
    await expect(bestStripBtn).toContainText(/Happiest/i);
  });

  test("scores in comparison strip match fixture data", async ({ page }) => {
    await runSearch(page, THREE_ROUTES);
    for (const route of THREE_ROUTES.routes) {
      const scoreEl = page.getByTestId(`route-score-${route.id}`);
      await expect(scoreEl).toContainText(String(route.happyScore));
    }
  });

  test("start and end names are displayed in the summary card", async ({ page }) => {
    await runSearch(page, THREE_ROUTES);
    // The summary card should contain start/end names
    const panel = page.locator(".bg-emerald-50.border.border-emerald-200").first();
    await expect(panel).toContainText(THREE_ROUTES.startName);
    await expect(panel).toContainText(THREE_ROUTES.endName);
  });

  test("partial data shows italic partial text in compact card view", async ({ page }) => {
    await runSearch(page, PARTIAL_DATA);
    // Route 1 has partial=true — compact view shows italic text when no highlights
    const card1 = page.getByTestId("route-card-1");
    await expect(card1).toContainText(/partial data/i);
  });

  // ── Error states ────────────────────────────────────────────────────────────

  test("no-routes error shows error banner", async ({ page }) => {
    await mockNavigateError(page, NO_ROUTES);
    await gotoHome(page);
    await fillAddressForm(page, "Nowhere", "Nonexistent");
    await page.getByTestId("btn-submit").click();
    await expect(page.getByTestId("error-banner")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("error-banner")).toContainText(/No routes found/i);
  });

  test("rate limit error shows error banner with rate limit message", async ({ page }) => {
    await mockNavigateError(page, RATE_LIMITED);
    await gotoHome(page);
    await fillAddressForm(page, "A", "B");
    // Force submit by filling both fields — we need text in both inputs
    await page.getByTestId("btn-submit").click();
    await expect(page.getByTestId("error-banner")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("error-banner")).toContainText(/Too many requests/i);
  });

  test("server error shows error banner", async ({ page }) => {
    await mockNavigateError(page, SERVER_ERROR);
    await gotoHome(page);
    await fillAddressForm(page, "Start Here", "End There");
    await page.getByTestId("btn-submit").click();
    await expect(page.getByTestId("error-banner")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("error-banner")).toContainText(/routing service/i);
  });

  test("error banner can be dismissed", async ({ page }) => {
    await mockNavigateError(page, NO_ROUTES);
    await gotoHome(page);
    await fillAddressForm(page, "A Place", "B Place");
    await page.getByTestId("btn-submit").click();
    await expect(page.getByTestId("error-banner")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("error-dismiss").click();
    await expect(page.getByTestId("error-banner")).not.toBeVisible();
  });

  test("two-route response renders both cards and comparison strip", async ({ page }) => {
    await runSearch(page, TWO_ROUTES);
    await expect(page.getByTestId("route-card-0")).toBeVisible();
    await expect(page.getByTestId("route-card-1")).toBeVisible();
    await expect(page.getByTestId("route-comparison-strip")).toBeVisible();
  });
});
