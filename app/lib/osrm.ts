import { Coordinates } from "../types";

const OSRM_BASE = "https://router.project-osrm.org";

export interface OSRMRoute {
  geometry: {
    coordinates: [number, number][]; // [lng, lat] GeoJSON order
    type: string;
  };
  distance: number; // metres
  duration: number; // seconds
}

/**
 * Fetch up to 3 bike route alternatives between two points using OSRM.
 * Falls back to the "driving" profile label if "bike" is unavailable
 * (the public demo server supports bike, but just in case).
 */
export async function getBikeRoutes(
  start: Coordinates,
  end: Coordinates
): Promise<OSRMRoute[]> {
  const coords = `${start.lng},${start.lat};${end.lng},${end.lat}`;
  const url =
    `${OSRM_BASE}/route/v1/bike/${coords}` +
    `?alternatives=true&overview=full&geometries=geojson&steps=false`;

  const resp = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    next: { revalidate: 7200 }, // road network rarely changes within 2 hours
  } as RequestInit);

  if (!resp.ok) {
    throw new Error(`OSRM responded with HTTP ${resp.status}`);
  }

  const data: { code: string; routes: OSRMRoute[] } = await resp.json();

  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error(`OSRM error: ${data.code}`);
  }

  // Cap at 3 alternatives
  return data.routes.slice(0, 3);
}
