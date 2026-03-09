import type { HappinessSignals, ScoreBreakdown } from "../types";

const WEIGHTS = {
  parks:     { multiplier: 12, cap: 30 },
  waterways: { multiplier: 10, cap: 25 }, // dedicated waterways
  water:     { multiplier: 8,  cap: 20 },
  green:     { multiplier: 5,  cap: 15 },
  lit:       { multiplier: 4,  cap: 10 },
  calmWater: { multiplier: 6,  cap: 15 }, // sheltered/calm water sections
  launch:    { multiplier: 3,  cap: 8  }, // boat launch / put-in access
  portage:   { multiplier: 2,  cap: 5  }, // portage access points
  rapids:    { multiplier: 5,  cap: 15 }, // penalty
  elevation: { multiplier: 3,  cap: 20 }, // penalty per km of ascent
  motorBoat: { multiplier: 4,  cap: 12 }, // penalty for motor boat traffic zones
} as const;

/**
 * Compute a 0–100 Happy Score from OSM signals and optional elevation data
 * for a canoe route.
 *
 * Positive contributors (max pts):
 *   Base          →  5 pts  (any routable path)
 *   Parks         → 30 pts  (shade, scenery along the bank)
 *   Waterways     → 25 pts  (dedicated waterway infrastructure)
 *   Water         → 20 pts  (rivers/lakes = scenic paddling)
 *   Green         → 15 pts  (forests, meadows along bank)
 *   Calm Water    → 15 pts  (sheltered/calm water sections)
 *   Lit           → 10 pts  (lighting along bank)
 *   Launch        →  8 pts  (boat launches, put-in points)
 *   Portage       →  5 pts  (portage access points)
 *
 * Penalties (max deduction):
 *   Rapids        → −15 pts  (whitewater difficulty)
 *   Elevation     → −20 pts  (steep portage terrain)
 *   Motor Boat    → −12 pts  (motor boat traffic zones = hazard)
 *
 * All raw counts normalised per km. Final score clamped to 0–100.
 */
export function computeHappyScore(
  signals: HappinessSignals,
  distanceKm: number,
  elevationGainM?: number
): { score: number; breakdown: ScoreBreakdown } {
  const norm = Math.max(distanceKm, 0.5);

  const parks     = Math.min((signals.parkCount      / norm) * WEIGHTS.parks.multiplier,     WEIGHTS.parks.cap);
  const waterways = Math.min((signals.waterwayCount  / norm) * WEIGHTS.waterways.multiplier, WEIGHTS.waterways.cap);
  const water     = Math.min((signals.waterCount     / norm) * WEIGHTS.water.multiplier,     WEIGHTS.water.cap);
  const green     = Math.min((signals.greenCount     / norm) * WEIGHTS.green.multiplier,     WEIGHTS.green.cap);
  const lit       = Math.min((signals.litCount       / norm) * WEIGHTS.lit.multiplier,       WEIGHTS.lit.cap);
  const calmWater = Math.min((signals.calmWaterCount / norm) * WEIGHTS.calmWater.multiplier, WEIGHTS.calmWater.cap);
  const launch    = Math.min((signals.launchCount    / norm) * WEIGHTS.launch.multiplier,    WEIGHTS.launch.cap);
  const portage   = Math.min((signals.portageCount   / norm) * WEIGHTS.portage.multiplier,   WEIGHTS.portage.cap);
  const base      = 5;

  // Penalties
  const rapids   = Math.min((signals.rapidCount     / norm) * WEIGHTS.rapids.multiplier,   WEIGHTS.rapids.cap);
  const elevation = elevationGainM != null
    ? Math.min((elevationGainM / norm) * WEIGHTS.elevation.multiplier, WEIGHTS.elevation.cap)
    : 0;
  const motorBoat = Math.min((signals.motorBoatCount / norm) * WEIGHTS.motorBoat.multiplier, WEIGHTS.motorBoat.cap);

  const raw   = base + parks + waterways + water + green + lit + calmWater + launch + portage
              - rapids - elevation - motorBoat;

  // Partial OSM data reduces confidence in the score — apply 15% penalty, floor at 5
  const adjusted = signals.partial ? Math.max(5, raw * 0.85) : raw;
  const score = Math.round(Math.max(0, Math.min(adjusted, 100)));

  return {
    score,
    breakdown: {
      parks:     Math.round(parks),
      waterways: Math.round(waterways),
      water:     Math.round(water),
      green:     Math.round(green),
      lit:       Math.round(lit),
      calmWater: Math.round(calmWater),
      launch:    Math.round(launch),
      portage:   Math.round(portage),
      base,
      rapids:    Math.round(rapids),
      elevation: Math.round(elevation),
      motorBoat: Math.round(motorBoat),
    },
  };
}
