/**
 * 05 — Happiest route verification (KEY TEST)
 *
 * Verifies that the UI correctly identifies and selects the happiest route
 * as determined by the server-side bestRouteId field.
 *
 * IMPORTANT BEHAVIORAL NOTE (from reading page.tsx):
 * The UI blindly trusts bestRouteId from the API response:
 *   setSelectedRouteId(nav.bestRouteId)
 *
 * The server validates bestRouteId:
 *   - If AI's bestRouteId is in validIds → use it (may differ from highest scorer)
 *   - Otherwise → fallback to scoredRoutes[0].id (= highest scorer since sorted desc)
 *
 * The server does NOT guarantee bestRouteId = highest happyScore.
 * The AI is allowed to choose a lower-scoring route if it judges it better overall.
 *
 * So the correct test assertion is:
 *   selectedRouteId === response.bestRouteId   (not necessarily the max score)
 */

import { test, expect } from "@playwright/test";
import {
  mockNavigateSuccess,
  gotoHome,
  fillAddressForm,
  submitAndWait,
} from "../helpers/mock";
import {
  THREE_ROUTES,
  TWO_ROUTES,
  WRONG_BEST_ROUTE_ID,
  INVALID_BEST_ROUTE_ID,
  SINGLE_ROUTE,
} from "../fixtures/api-responses";

async function runSearch(page: Parameters<typeof gotoHome>[0], fixture: typeof THREE_ROUTES) {
  await mockNavigateSuccess(page, fixture);
  await gotoHome(page);
  await fillAddressForm(page, "Central Park", "Brooklyn Bridge");
  await submitAndWait(page);
}

test.describe("Happiest route selection", () => {
  // ── THREE_ROUTES: bestRouteId=0 (highest scorer) ──────────────────────────

  test("THREE_ROUTES: UI selects bestRouteId=0 (highest scorer)", async ({ page }) => {
    await runSearch(page, THREE_ROUTES);

    // Highest score is route 0 (79) — and bestRouteId is also 0
    const maxScoreRoute = THREE_ROUTES.routes.reduce((a, b) =>
      a.happyScore > b.happyScore ? a : b
    );
    expect(maxScoreRoute.id).toBe(0);
    expect(THREE_ROUTES.bestRouteId).toBe(0);

    await expect(page.getByTestId(`route-card-${THREE_ROUTES.bestRouteId}`))
      .toHaveAttribute("aria-pressed", "true");
  });

  test("THREE_ROUTES: highest score route card shows 'Best Route' label", async ({ page }) => {
    await runSearch(page, THREE_ROUTES);
    const bestCard = page.getByTestId(`route-card-${THREE_ROUTES.bestRouteId}`);
    await expect(bestCard).toContainText(/Best Route/i);
  });

  test("THREE_ROUTES: routes are ordered descending by score in the UI", async ({ page }) => {
    await runSearch(page, THREE_ROUTES);

    // Read the strip scores in DOM order
    const scores = await Promise.all(
      THREE_ROUTES.routes.map(async (_, i) => {
        const el = page.getByTestId(`route-score-${i}`);
        const text = await el.textContent();
        return parseInt(text?.trim() ?? "0", 10);
      })
    );

    // Verify scores are descending (server sorts them; UI renders in that order)
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  // ── TWO_ROUTES: bestRouteId=0 (highest scorer) ────────────────────────────

  test("TWO_ROUTES: UI selects bestRouteId=0 (highest scorer)", async ({ page }) => {
    await runSearch(page, TWO_ROUTES);
    await expect(page.getByTestId(`route-card-${TWO_ROUTES.bestRouteId}`))
      .toHaveAttribute("aria-pressed", "true");
  });

  test("TWO_ROUTES: route 0 score (80) is higher than route 1 score (65)", async ({ page }) => {
    await runSearch(page, TWO_ROUTES);
    const score0 = page.getByTestId("route-score-0");
    const score1 = page.getByTestId("route-score-1");
    await expect(score0).toContainText("80");
    await expect(score1).toContainText("65");
  });

  // ── WRONG_BEST_ROUTE_ID: AI chose route 1, not route 0 ───────────────────
  //
  // RULE: UI follows bestRouteId from the API, even if it's not the max scorer.
  // The server allows AI to select a lower-scoring route (route 1, score 75)
  // over the highest scorer (route 0, score 79) based on holistic judgment.
  // Since bestRouteId=1 is a valid id (in validIds), the server uses it.
  // The UI then selects route 1, not route 0.

  test("WRONG_BEST_ROUTE_ID: UI follows API bestRouteId even when not highest scorer", async ({ page }) => {
    await runSearch(page, WRONG_BEST_ROUTE_ID);

    // API says bestRouteId=1 (score 75), not route 0 (score 79)
    expect(WRONG_BEST_ROUTE_ID.bestRouteId).toBe(1);

    // UI must select route 1 (API's choice)
    await expect(page.getByTestId("route-card-1")).toHaveAttribute("aria-pressed", "true");
    // Route 0 must NOT be selected
    await expect(page.getByTestId("route-card-0")).toHaveAttribute("aria-pressed", "false");
  });

  test("WRONG_BEST_ROUTE_ID: 'Best Route' badge appears on AI-chosen route (not highest score)", async ({ page }) => {
    await runSearch(page, WRONG_BEST_ROUTE_ID);
    // Route 1 is bestRouteId, so it should show the Best Route badge
    await expect(page.getByTestId("route-card-1")).toContainText(/Best Route/i);
    // Route 0 (highest score but not chosen) should NOT show Best Route badge
    await expect(page.getByTestId("route-card-0")).not.toContainText(/Best Route/i);
  });

  // ── INVALID_BEST_ROUTE_ID: server corrects 99 → 0 ────────────────────────
  //
  // The server validates: if AI's bestRouteId is not in validIds, fall back to
  // scoredRoutes[0].id (the highest scorer). Our fixture already has bestRouteId=0
  // (as the server would return), so the UI should select route 0 cleanly.

  test("INVALID_BEST_ROUTE_ID: app handles gracefully, shows highest-scoring route", async ({ page }) => {
    await runSearch(page, INVALID_BEST_ROUTE_ID);
    // bestRouteId in fixture is already corrected to 0
    await expect(page.getByTestId("route-card-0")).toHaveAttribute("aria-pressed", "true");
    // No crash — all cards visible
    await expect(page.getByTestId("route-card-0")).toBeVisible();
    await expect(page.getByTestId("route-card-1")).toBeVisible();
    await expect(page.getByTestId("route-card-2")).toBeVisible();
  });

  // ── SINGLE_ROUTE: only one route available ────────────────────────────────

  test("SINGLE_ROUTE: single route is selected by default", async ({ page }) => {
    await runSearch(page, SINGLE_ROUTE);
    await expect(page.getByTestId("route-card-0")).toHaveAttribute("aria-pressed", "true");
  });

  test("SINGLE_ROUTE: single route shows Best Route badge", async ({ page }) => {
    await runSearch(page, SINGLE_ROUTE);
    await expect(page.getByTestId("route-card-0")).toContainText(/Best Route/i);
  });

  // ── Score verification ─────────────────────────────────────────────────────

  test("scores displayed in strip match fixture data exactly", async ({ page }) => {
    await runSearch(page, THREE_ROUTES);
    const expectedScores: Record<number, number> = {};
    for (const r of THREE_ROUTES.routes) {
      expectedScores[r.id] = r.happyScore;
    }

    for (const [id, score] of Object.entries(expectedScores)) {
      const el = page.getByTestId(`route-score-${id}`);
      await expect(el).toContainText(String(score));
    }
  });
});
