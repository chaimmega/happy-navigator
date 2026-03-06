import type { HappinessSignals } from "../types";

const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/**
 * Evenly sample up to `maxPoints` coordinates from a polyline,
 * always including the first AND last point so the full route is represented.
 */
export function sampleCoords(
  coords: [number, number][],
  maxPoints = 10
): [number, number][] {
  if (coords.length <= maxPoints) return coords;
  const step = (coords.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, i) => coords[Math.round(i * step)]);
}

/**
 * Build a compact Overpass QL query that checks all sampled points in a single
 * request using the multi-point `around` syntax.
 *
 * Tag categories queried:
 *   Parks / leisure green areas
 *   Green land-use (forest, grass, meadow)
 *   Water (natural + waterway)
 *   Cycleways / bike infrastructure (incl. cycleway:left/right=track)
 *   Lit roads (street lighting)
 *   Segregated cycle tracks (physically separated from traffic)
 *   Rough surfaces (gravel, dirt, cobblestone — comfort penalty)
 *   Friendly roads (living_street, pedestrian areas, bicycle roads)
 *   Traffic calming features (speed bumps, tables, etc.)
 *   Hostile roads (trunk, primary, motorway — traffic stress penalty)
 */
function buildQuery(points: [number, number][], radiusM = 250): string {
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
  way["cycleway:left"~"^(lane|track)$"](${around});
  way["cycleway:right"~"^(lane|track)$"](${around});
  way["cycleway:both"~"^(lane|track)$"](${around});
  node["cycleway"~"^(lane|track)$"](${around});
  way["lit"="yes"](${around});
  way["surface"~"^(gravel|dirt|cobblestone|sand|unpaved|earth|mud|grass|compacted)$"](${around});
  way["highway"~"^(living_street|pedestrian)$"](${around});
  way["bicycle_road"="yes"](${around});
  way["cyclestreet"="yes"](${around});
  node["traffic_calming"](${around});
  way["traffic_calming"](${around});
  way["highway"~"^(trunk|primary|motorway)$"](${around});
  way["highway"~"^(trunk_link|primary_link|motorway_link)$"](${around});
);
out tags qt;`;
}

const ROUGH_SURFACES = new Set([
  "gravel", "dirt", "cobblestone", "sand", "unpaved", "earth", "mud", "grass", "compacted",
]);

const EMPTY_SIGNALS: HappinessSignals = {
  parkCount: 0, waterCount: 0, cyclewayCount: 0, greenCount: 0,
  litCount: 0, segregatedCount: 0, roughSurfaceCount: 0,
  friendlyRoadCount: 0, trafficCalmingCount: 0, hostileRoadCount: 0,
  partial: true,
};

/**
 * Fetch from Overpass, trying fallback servers on failure.
 */
async function fetchOverpass(query: string): Promise<Response> {
  let lastErr: unknown;
  for (const server of OVERPASS_SERVERS) {
    try {
      const resp = await fetch(server, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(14000),
      });
      if (resp.ok) return resp;
      lastErr = new Error(`HTTP ${resp.status} from ${server}`);
    } catch (err) {
      lastErr = err;
      console.warn(`[overpass] ${server} failed, trying next…`, err);
    }
  }
  throw lastErr;
}

/**
 * Query OSM via Overpass for happiness signals along a route.
 * Degrades gracefully on timeout / rate-limit — returns zero counts with partial=true.
 */
export async function getHappinessSignals(
  coords: [number, number][]
): Promise<HappinessSignals> {
  const sampled = sampleCoords(coords, 10);
  const query = buildQuery(sampled);

  try {
    const resp = await fetchOverpass(query);
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
    let friendlyRoadCount = 0;
    let trafficCalmingCount = 0;
    let hostileRoadCount = 0;

    for (const el of elements) {
      const t = el.tags ?? {};

      if (t.leisure === "park" || t.leisure === "garden") parkCount++;

      if (
        t.landuse === "forest" || t.landuse === "grass" ||
        t.landuse === "meadow" || t.landuse === "village_green" ||
        t.natural === "wood" || t.natural === "scrub" || t.natural === "heath"
      ) greenCount++;

      if (t.natural === "water" || t.waterway) waterCount++;

      if (t.highway === "cycleway" || t.cycleway) cyclewayCount++;

      if (t.lit === "yes") litCount++;

      // Physically separated cycle tracks — check both way-level and side-specific tags
      if (
        t.cycleway === "track" ||
        t["cycleway:left"] === "track" ||
        t["cycleway:right"] === "track" ||
        t["cycleway:both"] === "track"
      ) segregatedCount++;

      if (t.surface && ROUGH_SURFACES.has(t.surface)) roughSurfaceCount++;

      // Friendly road types (low-stress cycling environment)
      if (
        t.highway === "living_street" ||
        t.highway === "pedestrian" ||
        t.bicycle_road === "yes" ||
        t.cyclestreet === "yes"
      ) friendlyRoadCount++;

      // Traffic calming (speed humps, tables, chicanes, etc.)
      if (t.traffic_calming) trafficCalmingCount++;

      // Hostile road types (high traffic stress — penalty)
      if (
        t.highway === "trunk" || t.highway === "primary" ||
        t.highway === "motorway" || t.highway === "trunk_link" ||
        t.highway === "primary_link" || t.highway === "motorway_link"
      ) hostileRoadCount++;
    }

    return {
      parkCount, waterCount, cyclewayCount, greenCount,
      litCount, segregatedCount, roughSurfaceCount,
      friendlyRoadCount, trafficCalmingCount, hostileRoadCount,
      partial: false,
    };
  } catch (err) {
    console.warn("[overpass] all servers failed (degrading gracefully):", err);
    return EMPTY_SIGNALS;
  }
}
