import { Coordinates } from "../types";

// Prefer a server-only key; fall back to the public key if not set
const API_KEY = process.env.GOOGLE_MAPS_SERVER_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const DIRECTIONS_BASE = "https://maps.googleapis.com/maps/api/directions/json";

export interface OSRMRoute {
  geometry: {
    coordinates: [number, number][]; // [lng, lat] GeoJSON order
    type: string;
  };
  distance: number; // metres
  duration: number; // seconds
}

/**
 * Decode a Google Maps encoded polyline string into an array of [lat, lng] pairs.
 * Algorithm: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

/**
 * Fetch canoe route alternatives between two points (with optional via-point)
 * using Google Directions API.
 * Uses walking mode — best available for waterside / portage routes.
 */
export async function getCanoeRoutes(
  start: Coordinates,
  end: Coordinates,
  via?: Coordinates
): Promise<OSRMRoute[]> {
  const params = new URLSearchParams({
    origin: `${start.lat},${start.lng}`,
    destination: `${end.lat},${end.lng}`,
    mode: "walking",
    alternatives: "true",
    key: API_KEY,
  });

  if (via) {
    params.set("waypoints", `${via.lat},${via.lng}`);
  }

  const url = `${DIRECTIONS_BASE}?${params.toString()}`;

  const resp = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    next: { revalidate: 7200 },
  } as RequestInit);

  if (!resp.ok) {
    throw new Error(`Google Directions responded with HTTP ${resp.status}`);
  }

  const data: {
    status: string;
    routes: Array<{
      overview_polyline: { points: string };
      legs: Array<{
        distance: { value: number };
        duration: { value: number };
      }>;
    }>;
  } = await resp.json();

  if (data.status !== "OK" || !data.routes?.length) {
    throw new Error(`Google Directions error: ${data.status}`);
  }

  return data.routes.slice(0, 3).map((route) => {
    // Decode polyline: Google returns [lat, lng], we need [lng, lat] for GeoJSON order
    const latLngPoints = decodePolyline(route.overview_polyline.points);
    const coordinates: [number, number][] = latLngPoints.map(([lat, lng]) => [lng, lat]);

    // Sum distance and duration across all legs
    const distance = route.legs.reduce((sum, leg) => sum + leg.distance.value, 0);
    const duration = route.legs.reduce((sum, leg) => sum + leg.duration.value, 0);

    return {
      geometry: { coordinates, type: "LineString" },
      distance,
      duration,
    };
  });
}
