export interface Coordinates {
  lat: number;
  lng: number;
}

/** Raw signals collected from OSM Overpass for a route */
export interface HappinessSignals {
  parkCount: number;
  waterCount: number;
  cyclewayCount: number;
  greenCount: number;
  litCount: number;           // ways with lit=yes (street lighting)
  segregatedCount: number;    // ways with cycleway=track (physically separated)
  roughSurfaceCount: number;  // ways with gravel/dirt/cobblestone etc.
  friendlyRoadCount: number;  // living_street + pedestrian + bicycle_road
  trafficCalmingCount: number; // traffic_calming=* (speed bumps, tables, etc.)
  hostileRoadCount: number;   // trunk/primary/motorway near route (penalty)
  /** true when Overpass timed out / errored — scores are estimated */
  partial: boolean;
}

/** Per-category score contributions, each capped at their max */
export interface ScoreBreakdown {
  parks: number;        // 0–30
  cycleways: number;    // 0–25
  water: number;        // 0–20
  green: number;        // 0–15
  lit: number;          // 0–10
  segregated: number;   // 0–15
  friendlyRoad: number; // 0–8
  trafficCalming: number; // 0–5
  base: number;         // always 5
  roughSurface: number; // 0–15 (penalty magnitude, subtracted from score)
  elevation: number;    // 0–20 (penalty magnitude, subtracted from score)
  hostileRoad: number;  // 0–12 (penalty magnitude, subtracted from score)
}

/** A route from OSRM, enriched with happiness data */
export interface ScoredRoute {
  id: number;
  /** [lng, lat] pairs — OSRM's native GeoJSON order */
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
  /** Pre-resolved coords from Photon autocomplete — skips Nominatim geocoding */
  startCoords?: { lat: number; lng: number };
  endCoords?: { lat: number; lng: number };
  googleMapsUrl?: string;
  /** Optional via-point (waypoint) to route through between start and end */
  via?: { text: string; coords?: { lat: number; lng: number } };
}
