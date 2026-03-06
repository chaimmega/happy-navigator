import { sampleCoords } from "./overpass";

const ELEV_BASE = "https://api.opentopodata.org/v1/srtm30m";
// OpenTopoData allows up to 100 locations per call — use more for accurate profiles
const SAMPLE_COUNT = 50;

/**
 * Fetch elevation data for a route via OpenTopoData (free, no API key).
 * Samples up to 10 waypoints from the route geometry and computes total ascent.
 *
 * Limits: 1000 calls/day, 100 locations/call — well within budget for this app.
 * Degrades gracefully on timeout/error — returns null (caller skips elevation scoring).
 */
export async function getRouteElevation(
  coords: [number, number][] // [lng, lat] GeoJSON order
): Promise<{ elevationPoints: number[]; gainM: number } | null> {
  const sampled = sampleCoords(coords, SAMPLE_COUNT);

  // OpenTopoData expects lat,lng order (opposite of GeoJSON)
  const locations = sampled.map(([lng, lat]) => `${lat},${lng}`).join("|");
  const url = `${ELEV_BASE}?locations=${encodeURIComponent(locations)}`;

  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { Accept: "application/json" },
    });

    if (!resp.ok) {
      console.warn("[elevation] HTTP error:", resp.status);
      return null;
    }

    const data: {
      status: string;
      results: Array<{ elevation: number | null }>;
    } = await resp.json();

    if (data.status !== "OK" || !data.results?.length) {
      console.warn("[elevation] unexpected response status:", data.status);
      return null;
    }

    // Filter out null elevations (ocean / data gaps)
    const elevationPoints = data.results
      .map((r) => r.elevation)
      .filter((e): e is number => e != null);

    if (elevationPoints.length < 2) return null;

    // Compute total ascent (sum of positive elevation deltas only)
    let gainM = 0;
    for (let i = 1; i < elevationPoints.length; i++) {
      const delta = elevationPoints[i] - elevationPoints[i - 1];
      if (delta > 0) gainM += delta;
    }

    return { elevationPoints, gainM };
  } catch (err) {
    console.warn("[elevation] request failed (degrading gracefully):", err);
    return null;
  }
}
