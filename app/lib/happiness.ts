import type { HappinessSignals, ScoreBreakdown } from "../types";

const WEIGHTS = {
  parks:       { multiplier: 12, cap: 30 },
  cycleways:   { multiplier: 10, cap: 25 },
  water:       { multiplier: 8,  cap: 20 },
  green:       { multiplier: 5,  cap: 15 },
  lit:         { multiplier: 4,  cap: 10 },
  segregated:  { multiplier: 6,  cap: 15 },
  roughSurface:{ multiplier: 5,  cap: 15 }, // penalty
  elevation:   { multiplier: 3,  cap: 20 }, // penalty per km of ascent
} as const;

/**
 * Compute a 0–100 Happy Score from OSM signals and optional elevation data.
 *
 * Positive contributors (max contribution):
 *   Parks       → up to 30 pts  (shade, scenery, safety)
 *   Cycleways   → up to 25 pts  (dedicated bike infra = safety + ease)
 *   Water       → up to 20 pts  (rivers/lakes = scenic)
 *   Green       → up to 15 pts  (forests, meadows = pleasant)
 *   Segregated  → up to 15 pts  (physically separated tracks = safest infra)
 *   Lit         → up to 10 pts  (street lighting = safe at any hour)
 *   Base        → 5 pts         (any routable path)
 *
 * Penalties (max deduction):
 *   Rough surface → up to −15 pts  (gravel, dirt, cobblestones)
 *   Elevation     → up to −20 pts  (steep ascent per km)
 *
 * All raw counts are normalised per km to prevent long routes
 * from winning purely by volume. Final score is clamped to 0–100.
 */
export function computeHappyScore(
  signals: HappinessSignals,
  distanceKm: number,
  elevationGainM?: number
): { score: number; breakdown: ScoreBreakdown } {
  const norm = Math.max(distanceKm, 0.5);

  const parks      = Math.min((signals.parkCount      / norm) * WEIGHTS.parks.multiplier,      WEIGHTS.parks.cap);
  const cycleways  = Math.min((signals.cyclewayCount  / norm) * WEIGHTS.cycleways.multiplier,  WEIGHTS.cycleways.cap);
  const water      = Math.min((signals.waterCount     / norm) * WEIGHTS.water.multiplier,      WEIGHTS.water.cap);
  const green      = Math.min((signals.greenCount     / norm) * WEIGHTS.green.multiplier,      WEIGHTS.green.cap);
  const lit        = Math.min((signals.litCount       / norm) * WEIGHTS.lit.multiplier,        WEIGHTS.lit.cap);
  const segregated = Math.min((signals.segregatedCount/ norm) * WEIGHTS.segregated.multiplier, WEIGHTS.segregated.cap);
  const base       = 5;

  // Penalties
  const roughSurface = Math.min((signals.roughSurfaceCount / norm) * WEIGHTS.roughSurface.multiplier, WEIGHTS.roughSurface.cap);
  const elevation    = elevationGainM != null
    ? Math.min((elevationGainM / norm) * WEIGHTS.elevation.multiplier, WEIGHTS.elevation.cap)
    : 0;

  const raw   = base + parks + cycleways + water + green + lit + segregated - roughSurface - elevation;
  const score = Math.round(Math.max(0, Math.min(raw, 100)));

  return {
    score,
    breakdown: {
      parks:        Math.round(parks),
      cycleways:    Math.round(cycleways),
      water:        Math.round(water),
      green:        Math.round(green),
      lit:          Math.round(lit),
      segregated:   Math.round(segregated),
      base,
      roughSurface: Math.round(roughSurface),
      elevation:    Math.round(elevation),
    },
  };
}
