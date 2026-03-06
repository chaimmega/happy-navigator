import type { HappinessSignals } from "../types";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

/**
 * Evenly sample up to `maxPoints` coordinates from a polyline,
 * always including the first AND last point so the full route is represented.
 */
export function sampleCoords(
  coords: [number, number][],
  maxPoints = 6
): [number, number][] {
  if (coords.length <= maxPoints) return coords;
  // Distribute indices evenly from 0 to coords.length-1
  const step = (coords.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, i) => coords[Math.round(i * step)]);
}

/**
 * Build a compact Overpass QL query that checks all sampled points in a single
 * request using the multi-point `around` syntax.
 *
 * Queried tag categories:
 *   - Parks / leisure green areas
 *   - Green land-use (forest, grass, meadow)
 *   - Water (natural + waterway)
 *   - Cycleways / bike infrastructure
 *   - Lit roads (street lighting)
 *   - Segregated cycle tracks (physically separated from traffic)
 *   - Rough surfaces (gravel, dirt, cobblestone — comfort penalty)
 */
function buildQuery(points: [number, number][], radiusM = 200): string {
  // Overpass multi-around syntax: around:radius,lat1,lng1,lat2,lng2,...
  const coords = points.map(([lng, lat]) => `${lat},${lng}`).join(",");
  const around = `around:${radiusM},${coords}`;

  return `[out:json][timeout:12];
(
  node["leisure"="park"](${around});
  way["leisure"="park"](${around});
  way["leisure"="garden"](${around});
  way["landuse"~"^(forest|grass|meadow|village_green)$"](${around});
  way["natural"~"^(wood|scrub|heath)$"](${around});
  node["natural"="water"](${around});
  way["natural"="water"](${around});
  way["waterway"~"^(river|canal|stream|riverbank)$"](${around});
  way["highway"="cycleway"](${around});
  way["cycleway"~"^(lane|track|shared_lane|opposite_lane)$"](${around});
  node["cycleway"~"^(lane|track)$"](${around});
  way["lit"="yes"](${around});
  way["cycleway"="track"](${around});
  way["surface"~"^(gravel|dirt|cobblestone|sand|unpaved|earth|mud|grass|compacted)$"](${around});
);
out tags qt;`;
}

const ROUGH_SURFACES = new Set([
  "gravel", "dirt", "cobblestone", "sand", "unpaved", "earth", "mud", "grass", "compacted",
]);

/**
 * Query OSM via Overpass for happiness signals along a route.
 * Degrades gracefully on timeout / rate-limit — returns zero counts with partial=true.
 */
export async function getHappinessSignals(
  coords: [number, number][]
): Promise<HappinessSignals> {
  const sampled = sampleCoords(coords, 6);
  const query = buildQuery(sampled);

  try {
    const resp = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(14000),
    });

    if (!resp.ok) {
      console.warn("[overpass] HTTP error:", resp.status);
      return { parkCount: 0, waterCount: 0, cyclewayCount: 0, greenCount: 0, litCount: 0, segregatedCount: 0, roughSurfaceCount: 0, partial: true };
    }

    const data: { elements: Array<{ tags?: Record<string, string> }> } =
      await resp.json();
    const elements = data.elements ?? [];

    let parkCount = 0;
    let waterCount = 0;
    let cyclewayCount = 0;
    let greenCount = 0;
    let litCount = 0;
    let segregatedCount = 0;
    let roughSurfaceCount = 0;

    for (const el of elements) {
      const t = el.tags ?? {};

      if (t.leisure === "park" || t.leisure === "garden") parkCount++;

      if (
        t.landuse === "forest" ||
        t.landuse === "grass" ||
        t.landuse === "meadow" ||
        t.landuse === "village_green" ||
        t.natural === "wood" ||
        t.natural === "scrub" ||
        t.natural === "heath"
      )
        greenCount++;

      if (t.natural === "water" || t.waterway) waterCount++;

      if (t.highway === "cycleway" || t.cycleway) cyclewayCount++;

      if (t.lit === "yes") litCount++;

      // cycleway=track = physically separated from road traffic (highest quality)
      if (t.cycleway === "track") segregatedCount++;

      if (t.surface && ROUGH_SURFACES.has(t.surface)) roughSurfaceCount++;
    }

    return { parkCount, waterCount, cyclewayCount, greenCount, litCount, segregatedCount, roughSurfaceCount, partial: false };
  } catch (err) {
    console.warn("[overpass] request failed (degrading gracefully):", err);
    return { parkCount: 0, waterCount: 0, cyclewayCount: 0, greenCount: 0, litCount: 0, segregatedCount: 0, roughSurfaceCount: 0, partial: true };
  }
}
