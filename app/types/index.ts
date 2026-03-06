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
  /** true when Overpass timed out / errored — scores are estimated */
  partial: boolean;
}

/** Per-category score contributions, each capped at their max */
export interface ScoreBreakdown {
  parks: number;     // 0–30
  cycleways: number; // 0–25
  water: number;     // 0–20
  green: number;     // 0–15
  base: number;      // always 10
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
}
