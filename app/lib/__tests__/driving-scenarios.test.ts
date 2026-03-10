import { describe, it, expect } from "vitest";
import { computeHappyScore } from "../happiness";
import type { HappinessSignals } from "../../types";

/**
 * 10 realistic driving route scenarios — verifies that the scoring
 * formula produces sensible results and all signal counts are reflected
 * accurately in the breakdown and final score.
 */

function signals(overrides: Partial<HappinessSignals> = {}): HappinessSignals {
  return {
    parkCount: 0, waterfrontCount: 0, scenicRoadCount: 0, greenCount: 0,
    litCount: 0, lowTrafficCount: 0, constructionCount: 0,
    restStopCount: 0, viewpointCount: 0, highwayCount: 0,
    partial: false,
    ...overrides,
  };
}

describe("10 driving route scenarios", () => {
  // ─── 1. NYC: Central Park → Brooklyn Bridge (short scenic urban drive) ──────
  it("Case 1: NYC Central Park → Brooklyn Bridge — urban scenic", () => {
    const s = signals({
      parkCount: 4,        // Central Park + nearby gardens
      waterfrontCount: 1,  // East River glimpse
      scenicRoadCount: 2,  // side streets through park area
      greenCount: 5,       // lots of tree cover
      litCount: 8,         // well-lit urban streets
      lowTrafficCount: 3,  // some residential blocks
      restStopCount: 2,    // cafés near the route
      viewpointCount: 0,
      constructionCount: 1,
      highwayCount: 0,
    });
    const distKm = 6.5;
    const { score, breakdown } = computeHappyScore(s, distKm);

    // Verify individual breakdown math
    expect(breakdown.parks).toBe(Math.round(Math.min((4 / distKm) * 12, 30)));
    expect(breakdown.green).toBe(Math.round(Math.min((5 / distKm) * 5, 15)));
    expect(breakdown.lit).toBe(Math.round(Math.min((8 / distKm) * 4, 10)));
    expect(breakdown.construction).toBe(Math.round(Math.min((1 / distKm) * 5, 15)));
    expect(breakdown.highway).toBe(0);

    // Score should be moderate-high for a nice urban drive
    expect(score).toBeGreaterThan(20);
    expect(score).toBeLessThanOrEqual(100);
    expect(breakdown.base).toBe(5);
  });

  // ─── 2. Pacific Coast Highway (scenic coastal drive) ────────────────────────
  it("Case 2: Pacific Coast Highway — scenic coastal drive", () => {
    const s = signals({
      parkCount: 3,
      waterfrontCount: 12,  // extensive coastline
      scenicRoadCount: 8,   // lots of scenic secondary roads
      greenCount: 4,
      litCount: 2,
      lowTrafficCount: 5,
      restStopCount: 3,     // rest stops along the coast
      viewpointCount: 4,    // coastal viewpoints
      constructionCount: 0,
      highwayCount: 1,
    });
    const distKm = 50;
    const { score, breakdown } = computeHappyScore(s, distKm);

    // At 50 km, 12 waterfront / 50 * 8 = 1.92 → rounds to 2
    expect(breakdown.waterfront).toBe(2);
    // 8 scenic / 50 * 10 = 1.6 → rounds to 2
    expect(breakdown.scenicRoads).toBe(2);
    // 4 viewpoints / 50 * 2 = 0.16 → rounds to 0 (low density over long route)
    expect(breakdown.viewpoints).toBe(0);

    // Scenic coastal drive should score above base
    expect(score).toBeGreaterThan(5);
  });

  // ─── 3. Interstate highway route (boring, should score low) ─────────────────
  it("Case 3: I-95 highway commute — mostly motorway, low score", () => {
    const s = signals({
      parkCount: 0,
      waterfrontCount: 0,
      scenicRoadCount: 0,
      greenCount: 0,
      litCount: 3,
      lowTrafficCount: 0,
      restStopCount: 1,
      viewpointCount: 0,
      constructionCount: 2,   // construction zones on highway
      highwayCount: 15,       // lots of motorway segments
    });
    const distKm = 30;
    const { score, breakdown } = computeHappyScore(s, distKm);

    // Highway penalty: 15/30 * 4 = 2
    expect(breakdown.highway).toBe(2);
    // Construction penalty: 2/30 * 5 = 0.33 → rounds to 0
    expect(breakdown.construction).toBe(0);

    // Should be a low score — base (5) + lit (0) + restStops (0) - highway (2) = ~4
    expect(score).toBeLessThan(10);
  });

  // ─── 4. Rural countryside drive ─────────────────────────────────────────────
  it("Case 4: Vermont countryside drive — green, scenic, low traffic", () => {
    const s = signals({
      parkCount: 1,
      waterfrontCount: 2,    // rivers and lakes
      scenicRoadCount: 10,   // lots of quiet country roads
      greenCount: 15,        // forests, meadows everywhere
      litCount: 0,           // no street lighting (rural)
      lowTrafficCount: 8,    // residential / country roads
      restStopCount: 1,
      viewpointCount: 2,
      constructionCount: 0,
      highwayCount: 0,
    });
    const distKm = 40;
    const { score, breakdown } = computeHappyScore(s, distKm);

    // Green and scenic roads should dominate
    expect(breakdown.green).toBeGreaterThan(0);
    expect(breakdown.scenicRoads).toBeGreaterThan(0);
    expect(breakdown.lowTraffic).toBeGreaterThan(0);

    // Features spread over 40 km — per-km density is low but still above base
    expect(score).toBeGreaterThan(8);
  });

  // ─── 5. Construction-heavy route ────────────────────────────────────────────
  it("Case 5: Route with heavy construction — penalties dominate", () => {
    const s = signals({
      parkCount: 2,
      scenicRoadCount: 1,
      greenCount: 1,
      constructionCount: 10,  // lots of construction
      highwayCount: 5,
    });
    const distKm = 10;
    const { score, breakdown } = computeHappyScore(s, distKm);

    // Construction penalty should cap at 15
    expect(breakdown.construction).toBeLessThanOrEqual(15);
    // Highway penalty should cap at 12
    expect(breakdown.highway).toBeLessThanOrEqual(12);

    // Score should be low due to penalties
    expect(score).toBeLessThan(30);
  });

  // ─── 6. Short residential drive ─────────────────────────────────────────────
  it("Case 6: Short residential neighborhood drive — 2 km", () => {
    const s = signals({
      parkCount: 1,
      greenCount: 2,
      litCount: 3,
      lowTrafficCount: 4,
    });
    const distKm = 2;
    const { score, breakdown } = computeHappyScore(s, distKm);

    // Per-km density is high for short distances
    expect(breakdown.parks).toBe(Math.round(Math.min((1 / 2) * 12, 30)));  // 6
    expect(breakdown.lowTraffic).toBe(Math.round(Math.min((4 / 2) * 6, 15)));  // 12

    // Should be a pleasant short drive
    expect(score).toBeGreaterThan(20);
  });

  // ─── 7. Lakefront drive ─────────────────────────────────────────────────────
  it("Case 7: Lake Tahoe loop — waterfront + viewpoints", () => {
    const s = signals({
      parkCount: 5,
      waterfrontCount: 20,   // lakefront throughout
      scenicRoadCount: 6,
      greenCount: 8,
      litCount: 1,
      lowTrafficCount: 4,
      restStopCount: 5,
      viewpointCount: 3,
      constructionCount: 0,
      highwayCount: 2,
    });
    const distKm = 115;
    const { score, breakdown } = computeHappyScore(s, distKm);

    // At 115 km, 20 waterfront / 115 * 8 = 1.39 → rounds to 1
    expect(breakdown.waterfront).toBe(1);
    // 5 restStops / 115 * 3 = 0.13 → rounds to 0
    expect(breakdown.restStops).toBe(0);

    // Even with features spread over 115km, should score above base
    expect(score).toBeGreaterThanOrEqual(5);
  });

  // ─── 8. Very short drive (sub-1km) — tests distance floor ──────────────────
  it("Case 8: Very short 0.3 km drive — distance floor at 0.5 km", () => {
    const s = signals({
      parkCount: 1,
      lowTrafficCount: 1,
    });
    const distKm = 0.3;
    const { score, breakdown } = computeHappyScore(s, distKm);

    // Distance floors at 0.5 km: (1/0.5)*12 = 24
    expect(breakdown.parks).toBe(24);
    // (1/0.5)*6 = 12
    expect(breakdown.lowTraffic).toBe(12);
    expect(score).toBeGreaterThan(30);
  });

  // ─── 9. Hilly mountain road ─────────────────────────────────────────────────
  it("Case 9: Mountain pass — scenic but steep elevation penalty", () => {
    const s = signals({
      parkCount: 2,
      waterfrontCount: 1,
      scenicRoadCount: 5,
      greenCount: 6,
      viewpointCount: 3,
      lowTrafficCount: 3,
    });
    const distKm = 25;
    const elevationGainM = 800;  // significant climb
    const { score, breakdown } = computeHappyScore(s, distKm, elevationGainM);

    // Elevation penalty: (800/25)*3 = 96, capped at 20
    expect(breakdown.elevation).toBe(20);

    // 5 scenic / 25 * 10 = 2
    expect(breakdown.scenicRoads).toBe(2);
    // 3 viewpoints / 25 * 2 = 0.24 → rounds to 0
    expect(breakdown.viewpoints).toBe(0);

    // Despite steep elevation penalty (20), scenic features + base offset it
    expect(score).toBeGreaterThanOrEqual(0);
  });

  // ─── 10. Partial data route — verifies 15% confidence penalty ──────────────
  it("Case 10: Partial data route — 15% penalty applied, floor 5", () => {
    const s = signals({
      parkCount: 3,
      scenicRoadCount: 4,
      greenCount: 2,
      waterfrontCount: 1,
      partial: true,   // Overpass timed out
    });
    const distKm = 10;
    const partial = computeHappyScore(s, distKm);

    // Same signals without partial
    const full = computeHappyScore(
      { ...s, partial: false },
      distKm
    );

    // Partial score should be exactly ~85% of full score (rounded)
    expect(partial.score).toBeLessThan(full.score);
    expect(partial.score).toBe(Math.round(Math.max(5, full.score * 0.85)));
  });
});

describe("score accuracy — verify each signal maps correctly to breakdown", () => {
  const distKm = 10; // fixed distance for predictable math

  it("parks: (count/km)*12, capped at 30", () => {
    const { breakdown } = computeHappyScore(signals({ parkCount: 5 }), distKm);
    // (5/10)*12 = 6
    expect(breakdown.parks).toBe(6);
  });

  it("scenicRoads: (count/km)*10, capped at 25", () => {
    const { breakdown } = computeHappyScore(signals({ scenicRoadCount: 5 }), distKm);
    // (5/10)*10 = 5
    expect(breakdown.scenicRoads).toBe(5);
  });

  it("waterfront: (count/km)*8, capped at 20", () => {
    const { breakdown } = computeHappyScore(signals({ waterfrontCount: 5 }), distKm);
    // (5/10)*8 = 4
    expect(breakdown.waterfront).toBe(4);
  });

  it("green: (count/km)*5, capped at 15", () => {
    const { breakdown } = computeHappyScore(signals({ greenCount: 5 }), distKm);
    // (5/10)*5 = 2.5 → rounded = 3 (actually 2 because Math.round(2.5) = 2 in JS... no, Math.round(2.5) = 3)
    expect(breakdown.green).toBe(3);
  });

  it("lowTraffic: (count/km)*6, capped at 15", () => {
    const { breakdown } = computeHappyScore(signals({ lowTrafficCount: 5 }), distKm);
    // (5/10)*6 = 3
    expect(breakdown.lowTraffic).toBe(3);
  });

  it("lit: (count/km)*4, capped at 10", () => {
    const { breakdown } = computeHappyScore(signals({ litCount: 5 }), distKm);
    // (5/10)*4 = 2
    expect(breakdown.lit).toBe(2);
  });

  it("restStops: (count/km)*3, capped at 8", () => {
    const { breakdown } = computeHappyScore(signals({ restStopCount: 5 }), distKm);
    // (5/10)*3 = 1.5 → rounded = 2
    expect(breakdown.restStops).toBe(2);
  });

  it("viewpoints: (count/km)*2, capped at 5", () => {
    const { breakdown } = computeHappyScore(signals({ viewpointCount: 5 }), distKm);
    // (5/10)*2 = 1
    expect(breakdown.viewpoints).toBe(1);
  });

  it("construction: (count/km)*5, capped at 15 — penalty", () => {
    const { breakdown } = computeHappyScore(signals({ constructionCount: 5 }), distKm);
    // (5/10)*5 = 2.5 → rounded = 3 (actually Math.round(2.5) = 3 in modern JS)
    expect(breakdown.construction).toBe(3);
  });

  it("highway: (count/km)*4, capped at 12 — penalty", () => {
    const { breakdown } = computeHappyScore(signals({ highwayCount: 5 }), distKm);
    // (5/10)*4 = 2
    expect(breakdown.highway).toBe(2);
  });

  it("elevation: (gainM/km)*3, capped at 20 — penalty", () => {
    const { breakdown } = computeHappyScore(signals(), distKm, 50);
    // (50/10)*3 = 15
    expect(breakdown.elevation).toBe(15);
  });
});
