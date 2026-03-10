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
 * Compute a bounding box string (south,west,north,east) from route coordinates
 * with a small buffer in degrees (~300m).
 */
function computeBbox(points: [number, number][], bufferDeg = 0.003): string {
  const lats = points.map(([, lat]) => lat);
  const lngs = points.map(([lng]) => lng);
  const s = Math.min(...lats) - bufferDeg;
  const w = Math.min(...lngs) - bufferDeg;
  const n = Math.max(...lats) + bufferDeg;
  const e = Math.max(...lngs) + bufferDeg;
  return `${s},${w},${n},${e}`;
}

/**
 * Build a compact Overpass QL query using a global bbox pre-filter + around corridor.
 *
 * Tag categories queried for driving happiness:
 *   Parks / leisure green areas
 *   Green land-use (forest, grass, meadow)
 *   Waterfront (natural water, coastline, riverbanks)
 *   Scenic roads (secondary, tertiary, unclassified — quieter roads)
 *   Low-traffic segments (residential, living_street)
 *   Viewpoints (tourism=viewpoint)
 *   Rest stops (amenity rest areas, cafés, picnic sites)
 *   Lit ways (well-lit streets)
 *   Construction zones (penalty)
 *   Highway / motorway segments (penalty)
 */
function buildQuery(points: [number, number][], radiusM = 250): string {
  const coords = points.map(([lng, lat]) => `${lat},${lng}`).join(",");
  const around = `around:${radiusM},${coords}`;
  const bbox = computeBbox(points);

  return `[out:json][timeout:12][bbox:${bbox}];
(
  node["leisure"="park"](${around});
  way["leisure"="park"](${around});
  way["leisure"="garden"](${around});
  way["landuse"~"^(forest|grass|meadow|village_green)$"](${around});
  way["natural"~"^(wood|scrub|heath)$"](${around});
  node["natural"="water"](${around});
  way["natural"="water"](${around});
  way["natural"="coastline"](${around});
  way["waterway"~"^(river|canal|riverbank)$"](${around});
  way["highway"~"^(secondary|tertiary|unclassified)$"](${around});
  way["highway"~"^(residential|living_street)$"](${around});
  node["tourism"="viewpoint"](${around});
  node["amenity"~"^(rest_area|cafe|picnic_site)$"](${around});
  node["highway"="rest_area"](${around});
  way["lit"="yes"](${around});
  way["highway"="construction"](${around});
  way["highway"~"^(motorway|trunk)$"](${around});
);
out tags qt;`;
}

const EMPTY_SIGNALS: HappinessSignals = {
  parkCount: 0, waterfrontCount: 0, scenicRoadCount: 0, greenCount: 0,
  litCount: 0, lowTrafficCount: 0, constructionCount: 0,
  restStopCount: 0, viewpointCount: 0, highwayCount: 0,
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
 * Query OSM via Overpass for happiness signals along a driving route.
 * Degrades gracefully on timeout / rate-limit — returns zero counts with partial=true.
 */
export async function getHappinessSignals(
  coords: [number, number][]
): Promise<HappinessSignals> {
  const sampled = sampleCoords(coords, 10);
  const query = buildQuery(sampled);

  try {
    const resp = await fetchOverpass(query);
    const rawText = await resp.text();
    const data: { elements?: Array<{ tags?: Record<string, string> }>; remark?: string } =
      JSON.parse(rawText);

    if (!data.elements || data.remark?.includes("error")) {
      console.warn("[overpass] unexpected response:", data.remark ?? "no elements field");
      return EMPTY_SIGNALS;
    }

    const elements = data.elements;
    console.log(`[overpass] ${elements.length} elements returned`);

    let parkCount = 0;
    let waterfrontCount = 0;
    let scenicRoadCount = 0;
    let greenCount = 0;
    let litCount = 0;
    let lowTrafficCount = 0;
    let constructionCount = 0;
    let restStopCount = 0;
    let viewpointCount = 0;
    let highwayCount = 0;

    for (const el of elements) {
      const t = el.tags ?? {};

      if (t.leisure === "park" || t.leisure === "garden") parkCount++;

      if (
        t.landuse === "forest" || t.landuse === "grass" ||
        t.landuse === "meadow" || t.landuse === "village_green" ||
        t.natural === "wood" || t.natural === "scrub" || t.natural === "heath"
      ) greenCount++;

      // Waterfront: lakes, rivers, coastline
      if (t.natural === "water" || t.natural === "coastline" || t.waterway) waterfrontCount++;

      // Scenic roads: quieter secondary/tertiary/unclassified roads
      if (
        t.highway === "secondary" || t.highway === "tertiary" ||
        t.highway === "unclassified"
      ) scenicRoadCount++;

      // Low-traffic residential streets
      if (t.highway === "residential" || t.highway === "living_street") lowTrafficCount++;

      if (t.lit === "yes") litCount++;

      // Viewpoints
      if (t.tourism === "viewpoint") viewpointCount++;

      // Rest stops, cafés, picnic sites
      if (
        t.amenity === "rest_area" || t.amenity === "cafe" ||
        t.amenity === "picnic_site" || t.highway === "rest_area"
      ) restStopCount++;

      // Construction zones (penalty)
      if (t.highway === "construction") constructionCount++;

      // Motorway / trunk roads (penalty — stressful driving)
      if (t.highway === "motorway" || t.highway === "trunk") highwayCount++;
    }

    return {
      parkCount, waterfrontCount, scenicRoadCount, greenCount,
      litCount, lowTrafficCount, constructionCount,
      restStopCount, viewpointCount, highwayCount,
      partial: false,
    };
  } catch (err) {
    console.warn("[overpass] all servers failed (degrading gracefully):", err);
    return EMPTY_SIGNALS;
  }
}
