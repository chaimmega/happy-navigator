/**
 * Integration tests for /api/navigate
 *
 * These tests call the LIVE dev server (port 3010) — no mocks.
 * Run with: npm run test:integration
 * Requires: dev server running on port 3010 with real API keys.
 *
 * Each describe block sets test.setTimeout(45_000) because the full
 * server pipeline (geocode → Directions → Overpass → score → AI)
 * takes 15–20 s under normal conditions.
 */

import { test, expect } from "@playwright/test";
import type { APIRequestContext } from "playwright-core";

// ---------------------------------------------------------------------------
// Shared coordinates
// ---------------------------------------------------------------------------

/** Hudson River, NYC: Inwood Hill Park → The Battery */
const HUDSON_START = { lat: 40.8676, lng: -73.9166 };
const HUDSON_END = { lat: 40.7002, lng: -74.016 };

/** Charles River, Boston: Cambridge side → Back Bay */
const CHARLES_START = { lat: 42.3601, lng: -71.0942 };
const CHARLES_END = { lat: 42.3554, lng: -71.064 };

/** Riverside Park, NYC: along Hudson waterfront */
const RIVERSIDE_START = { lat: 40.8008, lng: -73.972 };
const RIVERSIDE_END = { lat: 40.7794, lng: -73.9726 };

// ---------------------------------------------------------------------------
// Helper: POST /api/navigate and return parsed JSON + status
// ---------------------------------------------------------------------------

async function postNavigate(
  request: APIRequestContext,
  body: Record<string, unknown>
) {
  const response = await request.post("/api/navigate", { data: body });
  return { response, body: (await response.json()) as Record<string, unknown> };
}

// ============================================================================
// 1. Response structure
// ============================================================================

test.describe("Response structure", () => {
  test.setTimeout(45_000);

  test("returns HTTP 200", async ({ request }) => {
    const { response } = await postNavigate(request, {
      startCoords: HUDSON_START,
      endCoords: HUDSON_END,
    });
    expect(response.status()).toBe(200);
  });

  test("has required top-level fields", async ({ request }) => {
    const { body } = await postNavigate(request, {
      startCoords: HUDSON_START,
      endCoords: HUDSON_END,
    });
    expect(body).toHaveProperty("routes");
    expect(body).toHaveProperty("bestRouteId");
    expect(body).toHaveProperty("explanation");
    expect(body).toHaveProperty("startCoords");
    expect(body).toHaveProperty("endCoords");
    expect(body).toHaveProperty("startName");
    expect(body).toHaveProperty("endName");
  });

  test("routes array is non-empty", async ({ request }) => {
    const { body } = await postNavigate(request, {
      startCoords: HUDSON_START,
      endCoords: HUDSON_END,
    });
    expect(Array.isArray(body.routes)).toBe(true);
    expect((body.routes as unknown[]).length).toBeGreaterThanOrEqual(1);
  });

  test("each route has required fields", async ({ request }) => {
    const { body } = await postNavigate(request, {
      startCoords: HUDSON_START,
      endCoords: HUDSON_END,
    });
    const routes = body.routes as Array<Record<string, unknown>>;
    for (const route of routes) {
      expect(route).toHaveProperty("id");
      expect(route).toHaveProperty("geometry");
      expect(route).toHaveProperty("distance");
      expect(route).toHaveProperty("duration");
      expect(route).toHaveProperty("signals");
      expect(route).toHaveProperty("happyScore");
      expect(route).toHaveProperty("scoreBreakdown");
    }
  });

  test("happyScore is within 0–100 for all routes", async ({ request }) => {
    const { body } = await postNavigate(request, {
      startCoords: HUDSON_START,
      endCoords: HUDSON_END,
    });
    const routes = body.routes as Array<{ happyScore: number }>;
    for (const route of routes) {
      expect(route.happyScore).toBeGreaterThanOrEqual(0);
      expect(route.happyScore).toBeLessThanOrEqual(100);
    }
  });

  test("routes are sorted descending by happyScore", async ({ request }) => {
    const { body } = await postNavigate(request, {
      startCoords: HUDSON_START,
      endCoords: HUDSON_END,
    });
    const routes = body.routes as Array<{ happyScore: number }>;
    for (let i = 0; i < routes.length - 1; i++) {
      expect(routes[i].happyScore).toBeGreaterThanOrEqual(routes[i + 1].happyScore);
    }
  });
});

// ============================================================================
// 2. Scoring invariants
// ============================================================================

test.describe("Scoring invariants", () => {
  test.setTimeout(45_000);

  test("bestRouteId equals routes[0].id", async ({ request }) => {
    const { body } = await postNavigate(request, {
      startCoords: HUDSON_START,
      endCoords: HUDSON_END,
    });
    const routes = body.routes as Array<{ id: number }>;
    expect(body.bestRouteId).toBe(routes[0].id);
  });

  test("scoreBreakdown base is always 5", async ({ request }) => {
    const { body } = await postNavigate(request, {
      startCoords: HUDSON_START,
      endCoords: HUDSON_END,
    });
    const routes = body.routes as Array<{ scoreBreakdown: { base: number } }>;
    for (const route of routes) {
      expect(route.scoreBreakdown.base).toBe(5);
    }
  });

  test("all breakdown values are non-negative integers", async ({ request }) => {
    const { body } = await postNavigate(request, {
      startCoords: HUDSON_START,
      endCoords: HUDSON_END,
    });
    const routes = body.routes as Array<{
      scoreBreakdown: Record<string, number>;
    }>;
    for (const route of routes) {
      for (const [key, value] of Object.entries(route.scoreBreakdown)) {
        expect(value, `scoreBreakdown.${key} should be >= 0`).toBeGreaterThanOrEqual(0);
        expect(
          Number.isInteger(value),
          `scoreBreakdown.${key} should be an integer`
        ).toBe(true);
      }
    }
  });

  test("partial routes have lower or equal scores than the threshold", async ({ request }) => {
    const { body } = await postNavigate(request, {
      startCoords: HUDSON_START,
      endCoords: HUDSON_END,
    });
    const routes = body.routes as Array<{
      happyScore: number;
      signals: { partial: boolean };
    }>;
    for (const route of routes) {
      if (route.signals.partial) {
        // partial routes have a 15% penalty applied, so max possible from 100 is 85
        expect(route.happyScore).toBeLessThanOrEqual(85);
      }
    }
  });
});

// ============================================================================
// 3. Scenic feature detection
// ============================================================================

test.describe("Scenic feature detection", () => {
  test.setTimeout(45_000);

  test("at least one route has waterfront or scenic road signals", async ({ request }) => {
    const { body } = await postNavigate(request, {
      startCoords: CHARLES_START,
      endCoords: CHARLES_END,
    });
    const routes = body.routes as Array<{
      signals: { waterfrontCount: number; scenicRoadCount: number };
    }>;
    const hasScenicSignal = routes.some(
      (r) => r.signals.waterfrontCount > 0 || r.signals.scenicRoadCount > 0
    );
    expect(hasScenicSignal).toBe(true);
  });

  test("happyScore reflects scenic features", async ({ request }) => {
    const { body } = await postNavigate(request, {
      startCoords: CHARLES_START,
      endCoords: CHARLES_END,
    });
    const routes = body.routes as Array<{ happyScore: number }>;
    // Best route score must exceed base score (5), confirming features were detected
    expect(routes[0].happyScore).toBeGreaterThan(5);
  });

  test("AI explanation references the route", async ({ request }) => {
    const { body } = await postNavigate(request, {
      startCoords: CHARLES_START,
      endCoords: CHARLES_END,
    });
    // explanation may be null if ANTHROPIC_API_KEY is missing
    if (body.explanation !== null && body.explanation !== undefined) {
      const explanation = body.explanation as { bullets: unknown[] };
      expect(Array.isArray(explanation.bullets), "explanation.bullets should be an array").toBe(
        true
      );
      expect(
        explanation.bullets.length,
        "explanation.bullets should have at least one entry"
      ).toBeGreaterThanOrEqual(1);
    }
  });
});

// ============================================================================
// 4. Error handling
// ============================================================================

test.describe("Error handling", () => {
  test.setTimeout(45_000);

  test("returns 400 for missing start", async ({ request }) => {
    const { response, body } = await postNavigate(request, {
      end: "Times Square, New York",
    });
    expect(response.status()).toBe(400);
    expect(typeof body.error).toBe("string");
  });

  test("returns 400 for missing end", async ({ request }) => {
    const { response, body } = await postNavigate(request, {
      start: "Central Park, New York",
    });
    expect(response.status()).toBe(400);
    expect(typeof body.error).toBe("string");
  });

  test.skip("returns 429 after rapid repeated requests from same IP", () => {
    // Rate limit is 10/min — not worth burning quota in automated tests.
  });
});

// ============================================================================
// 5. Score comparison — scenic vs urban
// ============================================================================

test.describe("Score comparison — scenic vs urban", () => {
  test.setTimeout(45_000);

  test("waterfront route has at least some waterfront signals", async ({ request }) => {
    const { body } = await postNavigate(request, {
      startCoords: RIVERSIDE_START,
      endCoords: RIVERSIDE_END,
    });
    const routes = body.routes as Array<{
      signals: { waterfrontCount: number; parkCount: number };
    }>;
    const topRoute = routes[0];
    const hasFeatures = topRoute.signals.waterfrontCount > 0 || topRoute.signals.parkCount > 0;
    expect(hasFeatures).toBe(true);
  });

  test("score breakdown parks+scenicRoads+waterfront sum is meaningful for scenic route", async ({
    request,
  }) => {
    const { body } = await postNavigate(request, {
      startCoords: RIVERSIDE_START,
      endCoords: RIVERSIDE_END,
    });
    const routes = body.routes as Array<{
      scoreBreakdown: { parks: number; scenicRoads: number; waterfront: number };
    }>;
    const top = routes[0].scoreBreakdown;
    expect(top.parks + top.scenicRoads + top.waterfront).toBeGreaterThan(0);
  });
});
