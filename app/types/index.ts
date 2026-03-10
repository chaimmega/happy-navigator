export interface Coordinates {
  lat: number;
  lng: number;
}

/** Raw signals collected from OSM Overpass for a driving route */
export interface HappinessSignals {
  parkCount: number;
  waterfrontCount: number;     // waterfront areas near route (lakes, rivers, coastline)
  scenicRoadCount: number;     // scenic / quiet roads
  greenCount: number;
  litCount: number;            // ways with lit=yes (well-lit streets)
  lowTrafficCount: number;     // residential / low-traffic road segments
  constructionCount: number;   // construction zones (penalty)
  restStopCount: number;       // rest areas, cafés, amenities
  viewpointCount: number;      // tourism viewpoints / lookouts
  highwayCount: number;        // motorway / trunk road segments (penalty)
  /** true when Overpass timed out / errored — scores are estimated */
  partial: boolean;
}

/** Per-category score contributions, each capped at their max */
export interface ScoreBreakdown {
  parks: number;          // 0–30
  scenicRoads: number;    // 0–25
  waterfront: number;     // 0–20
  green: number;          // 0–15
  lowTraffic: number;     // 0–15
  lit: number;            // 0–10
  restStops: number;      // 0–8
  viewpoints: number;     // 0–5
  base: number;           // always 5
  construction: number;   // 0–15 (penalty magnitude, subtracted from score)
  elevation: number;      // 0–20 (penalty magnitude, subtracted from score)
  highway: number;        // 0–12 (penalty magnitude, motorway segments)
}

/** A route from Google Directions, enriched with happiness data */
export interface ScoredRoute {
  id: number;
  /** [lng, lat] pairs — GeoJSON order */
  geometry: [number, number][];
  distance: number; // metres
  duration: number; // seconds
  signals: HappinessSignals;
  happyScore: number; // 0–100
  scoreBreakdown: ScoreBreakdown;
  elevationGainM?: number;    // total ascent in metres (undefined if API unavailable)
  elevationPoints?: number[]; // sampled elevation values in metres for profile chart
}

export interface AIExplanation {
  bestRouteId: number;
  bullets: string[];
  suggestedStops?: string[];
}

export interface NavigateResponse {
  routes: ScoredRoute[];
  bestRouteId: number;
  explanation: AIExplanation | null;
  startCoords: Coordinates;
  endCoords: Coordinates;
  startName: string;
  endName: string;
}

export interface NavigateRequest {
  start?: string;
  end?: string;
  /** Pre-resolved coords from Places autocomplete — skips server geocoding */
  startCoords?: { lat: number; lng: number };
  endCoords?: { lat: number; lng: number };
  googleMapsUrl?: string;
  /** Optional via-point (waypoint) to route through between start and end */
  via?: { text: string; coords?: { lat: number; lng: number } };
}

// ─── Display helpers ─────────────────────────────────────────────────────────

export type ScoreTier = "scenic" | "okay" | "low";

export function getScoreTier(score: number): ScoreTier {
  if (score >= 70) return "scenic";
  if (score >= 40) return "okay";
  return "low";
}

export function formatDistance(meters: number, metric: boolean): string {
  if (metric) {
    const km = meters / 1000;
    return km < 0.1 ? "< 0.1 km" : `${km.toFixed(1)} km`;
  }
  const mi = meters / 1609.344;
  return mi < 0.1 ? "< 0.1 mi" : `${mi.toFixed(1)} mi`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return "< 1 min";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function formatElevation(meters: number, metric: boolean): string {
  if (metric) return `↑ ${Math.round(meters)} m`;
  return `↑ ${Math.round(meters * 3.28084)} ft`;
}

export function estimateCO2Saved(distanceMeters: number): number {
  return Math.round((distanceMeters / 1000) * 120);
}
