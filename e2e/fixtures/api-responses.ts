/**
 * Fixture data for mocking POST /api/navigate responses.
 *
 * Routes are sorted descending by happyScore (as the server always returns them).
 * bestRouteId matches the route with the highest score unless otherwise noted.
 *
 * Geometry uses [lng, lat] pairs (GeoJSON order) as the server produces.
 */

import type { NavigateResponse, ScoredRoute } from "../../app/types";

// ─── Shared helpers ────────────────────────────────────────────────────────────

function makeRoute(
  id: number,
  happyScore: number,
  overrides: Partial<ScoredRoute> = {}
): ScoredRoute {
  return {
    id,
    geometry: [
      [-74.006, 40.7128], // roughly NYC area
      [-74.0065, 40.714],
      [-74.007, 40.715],
    ],
    distance: 5000 + id * 800,   // metres
    duration: 3600 + id * 600,   // seconds
    happyScore,
    signals: {
      parkCount: 3 + id,
      waterfrontCount: 2,
      scenicRoadCount: 4,
      greenCount: 1,
      litCount: 0,
      lowTrafficCount: 2,
      constructionCount: 0,
      restStopCount: 1,
      viewpointCount: 0,
      highwayCount: 0,
      partial: false,
    },
    scoreBreakdown: {
      parks: Math.min(30, (3 + id) * 4),
      scenicRoads: 20,
      waterfront: 15,
      green: 5,
      lit: 0,
      lowTraffic: 10,
      restStops: 3,
      viewpoints: 0,
      base: 5,
      construction: 0,
      elevation: 0,
      highway: 0,
    },
    ...overrides,
  };
}

// ─── THREE_ROUTES ──────────────────────────────────────────────────────────────
// Three routes, sorted descending: 79 > 75 > 62. bestRouteId = 0 (highest scorer).

export const THREE_ROUTES: NavigateResponse = {
  routes: [
    makeRoute(0, 79),
    makeRoute(1, 75),
    makeRoute(2, 62),
  ],
  bestRouteId: 0,
  explanation: {
    bestRouteId: 0,
    bullets: [
      "Route A passes through 4 scenic road sections and 3 parks — the most scenic option.",
      "Low-traffic residential streets make driving relaxed throughout.",
      "Two waterfront areas along the route offer pleasant views.",
    ],
    suggestedStops: ["Riverside Park picnic area", "Lakeside viewpoint"],
  },
  startCoords: { lat: 40.7128, lng: -74.006 },
  endCoords:   { lat: 40.730, lng: -74.012 },
  startName: "Central Park, New York",
  endName:   "Brooklyn Bridge, New York",
};

// ─── TWO_ROUTES ───────────────────────────────────────────────────────────────
// Two routes: 80 > 65. bestRouteId = 0.

export const TWO_ROUTES: NavigateResponse = {
  routes: [
    makeRoute(0, 80),
    makeRoute(1, 65),
  ],
  bestRouteId: 0,
  explanation: {
    bestRouteId: 0,
    bullets: [
      "Route A offers the highest Happy Score with abundant parks and scenic roads.",
      "Green spaces line the route for the majority of the drive.",
    ],
    suggestedStops: [],
  },
  startCoords: { lat: 40.7128, lng: -74.006 },
  endCoords:   { lat: 40.730, lng: -74.012 },
  startName: "Start Location",
  endName:   "End Location",
};

// ─── PARTIAL_DATA ─────────────────────────────────────────────────────────────
// Two routes, one has partial=true on its signals (Overpass timed out).

export const PARTIAL_DATA: NavigateResponse = {
  routes: [
    makeRoute(0, 72),
    makeRoute(1, 55, {
      signals: {
        parkCount: 0,
        waterfrontCount: 0,
        scenicRoadCount: 0,
        greenCount: 0,
        litCount: 0,
        lowTrafficCount: 0,
        constructionCount: 0,
        restStopCount: 0,
        viewpointCount: 0,
        highwayCount: 0,
        partial: true,   // ← Overpass timed out for this route
      },
    }),
  ],
  bestRouteId: 0,
  explanation: {
    bestRouteId: 0,
    bullets: [
      "Route A has complete OSM data with multiple scenic road features.",
      "Route B data is partial — real score may differ.",
    ],
    suggestedStops: [],
  },
  startCoords: { lat: 40.7128, lng: -74.006 },
  endCoords:   { lat: 40.730, lng: -74.012 },
  startName: "Start A",
  endName:   "End B",
};

// ─── SINGLE_ROUTE ──────────────────────────────────────────────────────────────
// Only one route available.

export const SINGLE_ROUTE: NavigateResponse = {
  routes: [makeRoute(0, 68)],
  bestRouteId: 0,
  explanation: {
    bestRouteId: 0,
    bullets: [
      "Only one route is available for this trip.",
      "It still offers good scenic roads and some parks.",
    ],
    suggestedStops: [],
  },
  startCoords: { lat: 40.7128, lng: -74.006 },
  endCoords:   { lat: 40.730, lng: -74.012 },
  startName: "Single Start",
  endName:   "Single End",
};

// ─── WRONG_BEST_ROUTE_ID ──────────────────────────────────────────────────────
// Same routes as THREE_ROUTES but AI returned bestRouteId=1 (not the highest scorer).
// The server validates: if AI's bestRouteId is in validIds, it uses it.
// Routes are [0→79, 1→75, 2→62] so bestRouteId=1 (score 75) is valid but not highest.
// This tests whether the UI blindly follows bestRouteId from the API (yes, it does —
// see page.tsx line: setSelectedRouteId(nav.bestRouteId)).

export const WRONG_BEST_ROUTE_ID: NavigateResponse = {
  routes: [
    makeRoute(0, 79),
    makeRoute(1, 75),
    makeRoute(2, 62),
  ],
  bestRouteId: 1,   // AI chose route 1 (score 75), not the highest (route 0 = 79)
  explanation: {
    bestRouteId: 1,
    bullets: [
      "Route B is recommended despite a slightly lower score due to fewer highway segments.",
      "The AI considered practical driving factors beyond raw score.",
    ],
    suggestedStops: [],
  },
  startCoords: { lat: 40.7128, lng: -74.006 },
  endCoords:   { lat: 40.730, lng: -74.012 },
  startName: "Central Park, New York",
  endName:   "Brooklyn Bridge, New York",
};

// ─── INVALID_BEST_ROUTE_ID ────────────────────────────────────────────────────
// bestRouteId=99 is out of range. The server falls back to scoredRoutes[0].id.
// So this fixture should show bestRouteId=0 (server already fixed it).
// We simulate what the server would actually return after its validation logic.

export const INVALID_BEST_ROUTE_ID: NavigateResponse = {
  routes: [
    makeRoute(0, 79),
    makeRoute(1, 75),
    makeRoute(2, 62),
  ],
  bestRouteId: 0,   // server corrected 99 → 0 (scoredRoutes[0].id)
  explanation: {
    bestRouteId: 99,  // AI said 99 but server overrode it
    bullets: [
      "AI suggested an invalid route ID — falling back to highest scorer.",
    ],
    suggestedStops: [],
  },
  startCoords: { lat: 40.7128, lng: -74.006 },
  endCoords:   { lat: 40.730, lng: -74.012 },
  startName: "Central Park, New York",
  endName:   "Brooklyn Bridge, New York",
};

// ─── Error responses ──────────────────────────────────────────────────────────

export const NO_ROUTES = {
  status: 404,
  body: { error: "No routes found between these locations." },
};

export const RATE_LIMITED = {
  status: 429,
  body: { error: "Too many requests. Please wait a minute before trying again." },
};

export const SERVER_ERROR = {
  status: 502,
  body: { error: "Could not fetch routes. The routing service may be temporarily unavailable." },
};
