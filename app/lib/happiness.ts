import type { HappinessSignals, ScoreBreakdown } from "../types";

const WEIGHTS = {
  parks:          { multiplier: 12, cap: 30 },
  cycleways:      { multiplier: 10, cap: 25 },
  water:          { multiplier: 8,  cap: 20 },
  green:          { multiplier: 5,  cap: 15 },
  lit:            { multiplier: 4,  cap: 10 },
  segregated:     { multiplier: 6,  cap: 15 },
  friendlyRoad:   { multiplier: 3,  cap: 8  }, // living_street / pedestrian / bicycle_road
  trafficCalming: { multiplier: 2,  cap: 5  }, // speed humps, tables, chicanes
  roughSurface:   { multiplier: 5,  cap: 15 }, // penalty
  elevation:      { multiplier: 3,  cap: 20 }, // penalty per km of ascent
  hostileRoad:    { multiplier: 4,  cap: 12 }, // penalty for trunk/primary/motorway nearby
} as const;

/**
 * Compute a 0–100 Happy Score from OSM signals and optional elevation data.
 *
 * Positive contributors (max pts):
 *   Base          →  5 pts  (any routable path)
 *   Parks         → 30 pts  (shade, scenery, safety)
 *   Cycleways     → 25 pts  (dedicated bike infra)
 *   Water         → 20 pts  (rivers/lakes = scenic)
 *   Green         → 15 pts  (forests, meadows)
 *   Segregated    → 15 pts  (physically separated tracks)
 *   Lit           → 10 pts  (safe at any hour)
 *   FriendlyRoad  →  8 pts  (living_street, pedestrian zones, bicycle roads)
 *   TrafficCalming →  5 pts  (calmed streets = safer cycling)
 *
 * Penalties (max deduction):
 *   Rough surface → −15 pts  (gravel, dirt, cobblestones)
 *   Elevation     → −20 pts  (steep ascent per km)
 *   Hostile road  → −12 pts  (trunk/primary/motorway nearby = high stress)
 *
 * All raw counts normalised per km. Final score clamped to 0–100.
 */
export function computeHappyScore(
  signals: HappinessSignals,
  distanceKm: number,
  elevationGainM?: number
): { score: number; breakdown: ScoreBreakdown } {
  const norm = Math.max(distanceKm, 0.5);

  const parks         = Math.min((signals.parkCount       / norm) * WEIGHTS.parks.multiplier,         WEIGHTS.parks.cap);
  const cycleways     = Math.min((signals.cyclewayCount   / norm) * WEIGHTS.cycleways.multiplier,     WEIGHTS.cycleways.cap);
  const water         = Math.min((signals.waterCount      / norm) * WEIGHTS.water.multiplier,         WEIGHTS.water.cap);
  const green         = Math.min((signals.greenCount      / norm) * WEIGHTS.green.multiplier,         WEIGHTS.green.cap);
  const lit           = Math.min((signals.litCount        / norm) * WEIGHTS.lit.multiplier,           WEIGHTS.lit.cap);
  const segregated    = Math.min((signals.segregatedCount / norm) * WEIGHTS.segregated.multiplier,    WEIGHTS.segregated.cap);
  const friendlyRoad  = Math.min((signals.friendlyRoadCount   / norm) * WEIGHTS.friendlyRoad.multiplier,   WEIGHTS.friendlyRoad.cap);
  const trafficCalming = Math.min((signals.trafficCalmingCount / norm) * WEIGHTS.trafficCalming.multiplier, WEIGHTS.trafficCalming.cap);
  const base          = 5;

  // Penalties
  const roughSurface = Math.min((signals.roughSurfaceCount  / norm) * WEIGHTS.roughSurface.multiplier, WEIGHTS.roughSurface.cap);
  const elevation    = elevationGainM != null
    ? Math.min((elevationGainM / norm) * WEIGHTS.elevation.multiplier, WEIGHTS.elevation.cap)
    : 0;
  const hostileRoad  = Math.min((signals.hostileRoadCount / norm) * WEIGHTS.hostileRoad.multiplier, WEIGHTS.hostileRoad.cap);

  const raw   = base + parks + cycleways + water + green + lit + segregated + friendlyRoad + trafficCalming
              - roughSurface - elevation - hostileRoad;
  const score = Math.round(Math.max(0, Math.min(raw, 100)));

  return {
    score,
    breakdown: {
      parks:          Math.round(parks),
      cycleways:      Math.round(cycleways),
      water:          Math.round(water),
      green:          Math.round(green),
      lit:            Math.round(lit),
      segregated:     Math.round(segregated),
      friendlyRoad:   Math.round(friendlyRoad),
      trafficCalming: Math.round(trafficCalming),
      base,
      roughSurface:   Math.round(roughSurface),
      elevation:      Math.round(elevation),
      hostileRoad:    Math.round(hostileRoad),
    },
  };
}
