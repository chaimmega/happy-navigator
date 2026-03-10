import type { HappinessSignals, ScoreBreakdown } from "../types";

const WEIGHTS = {
  parks:        { multiplier: 12, cap: 30 },
  scenicRoads:  { multiplier: 10, cap: 25 }, // quieter scenic roads
  waterfront:   { multiplier: 8,  cap: 20 }, // waterfront areas
  green:        { multiplier: 5,  cap: 15 },
  lowTraffic:   { multiplier: 6,  cap: 15 }, // residential / low-traffic roads
  lit:          { multiplier: 4,  cap: 10 },
  restStops:    { multiplier: 3,  cap: 8  }, // rest areas, cafés, picnic sites
  viewpoints:   { multiplier: 2,  cap: 5  }, // scenic viewpoints
  construction: { multiplier: 5,  cap: 15 }, // penalty
  elevation:    { multiplier: 3,  cap: 20 }, // penalty per km of ascent
  highway:      { multiplier: 4,  cap: 12 }, // penalty for motorway / trunk road segments
} as const;

/**
 * Compute a 0–100 Happy Score from OSM signals and optional elevation data
 * for a driving route.
 *
 * Positive contributors (max pts):
 *   Base          →  5 pts  (any routable path)
 *   Parks         → 30 pts  (parks and gardens along the route)
 *   Scenic Roads  → 25 pts  (quieter secondary/tertiary roads)
 *   Waterfront    → 20 pts  (lakes, rivers, coastline nearby)
 *   Green         → 15 pts  (forests, meadows, green spaces)
 *   Low Traffic   → 15 pts  (residential / low-traffic segments)
 *   Lit           → 10 pts  (well-lit streets)
 *   Rest Stops    →  8 pts  (rest areas, cafés, picnic sites)
 *   Viewpoints    →  5 pts  (scenic viewpoints / lookouts)
 *
 * Penalties (max deduction):
 *   Construction  → −15 pts  (road construction zones)
 *   Elevation     → −20 pts  (steep terrain)
 *   Highway       → −12 pts  (motorway / trunk road segments = stressful)
 *
 * All raw counts normalised per km. Final score clamped to 0–100.
 */
export function computeHappyScore(
  signals: HappinessSignals,
  distanceKm: number,
  elevationGainM?: number
): { score: number; breakdown: ScoreBreakdown } {
  const norm = Math.max(distanceKm, 0.5);

  const parks       = Math.min((signals.parkCount        / norm) * WEIGHTS.parks.multiplier,       WEIGHTS.parks.cap);
  const scenicRoads = Math.min((signals.scenicRoadCount  / norm) * WEIGHTS.scenicRoads.multiplier, WEIGHTS.scenicRoads.cap);
  const waterfront  = Math.min((signals.waterfrontCount  / norm) * WEIGHTS.waterfront.multiplier,  WEIGHTS.waterfront.cap);
  const green       = Math.min((signals.greenCount       / norm) * WEIGHTS.green.multiplier,       WEIGHTS.green.cap);
  const lowTraffic  = Math.min((signals.lowTrafficCount  / norm) * WEIGHTS.lowTraffic.multiplier,  WEIGHTS.lowTraffic.cap);
  const lit         = Math.min((signals.litCount         / norm) * WEIGHTS.lit.multiplier,         WEIGHTS.lit.cap);
  const restStops   = Math.min((signals.restStopCount    / norm) * WEIGHTS.restStops.multiplier,   WEIGHTS.restStops.cap);
  const viewpoints  = Math.min((signals.viewpointCount   / norm) * WEIGHTS.viewpoints.multiplier,  WEIGHTS.viewpoints.cap);
  const base        = 5;

  // Penalties
  const construction = Math.min((signals.constructionCount / norm) * WEIGHTS.construction.multiplier, WEIGHTS.construction.cap);
  const elevation = elevationGainM != null
    ? Math.min((elevationGainM / norm) * WEIGHTS.elevation.multiplier, WEIGHTS.elevation.cap)
    : 0;
  const highway = Math.min((signals.highwayCount / norm) * WEIGHTS.highway.multiplier, WEIGHTS.highway.cap);

  const raw = base + parks + scenicRoads + waterfront + green + lowTraffic + lit + restStops + viewpoints
            - construction - elevation - highway;

  // Partial OSM data reduces confidence in the score — apply 15% penalty, floor at 5
  const adjusted = signals.partial ? Math.max(5, raw * 0.85) : raw;
  const score = Math.round(Math.max(0, Math.min(adjusted, 100)));

  return {
    score,
    breakdown: {
      parks:        Math.round(parks),
      scenicRoads:  Math.round(scenicRoads),
      waterfront:   Math.round(waterfront),
      green:        Math.round(green),
      lowTraffic:   Math.round(lowTraffic),
      lit:          Math.round(lit),
      restStops:    Math.round(restStops),
      viewpoints:   Math.round(viewpoints),
      base,
      construction: Math.round(construction),
      elevation:    Math.round(elevation),
      highway:      Math.round(highway),
    },
  };
}
