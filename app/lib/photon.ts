/**
 * Photon — Komoot's open geocoder built on OSM data.
 * https://photon.komoot.io
 *
 * Free, no API key, CORS-enabled, designed for real-time autocomplete.
 * Used by Komoot, OpenRouteService, and other cycling apps.
 */

const PHOTON_BASE = "https://photon.komoot.io/api";

export interface PhotonResult {
  displayName: string; // primary label shown in the input
  subtitle: string;    // secondary line (city, country)
  lat: number;
  lng: number;
  osm_value: string;   // park, city, street, museum, etc.
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] }; // [lng, lat]
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    district?: string;
    locality?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    osm_key?: string;
    osm_value?: string;
    type?: string;
  };
}

function buildLabel(p: PhotonFeature["properties"]): {
  displayName: string;
  subtitle: string;
} {
  // Primary name: named POI > street+number > locality > city
  const primary =
    p.name ||
    [p.housenumber, p.street].filter(Boolean).join(" ") ||
    p.locality ||
    p.city ||
    p.county ||
    "Unknown";

  // Subtitle: everything below the primary that adds context, deduped
  const secondary = [p.city || p.district, p.state, p.country]
    .filter(Boolean)
    .filter((v) => v !== primary)
    .join(", ");

  return { displayName: primary, subtitle: secondary };
}

/**
 * Search for places matching `query`.
 * Pass an AbortSignal to cancel in-flight requests when the user keeps typing.
 */
export async function searchPlaces(
  query: string,
  signal?: AbortSignal
): Promise<PhotonResult[]> {
  if (query.trim().length < 2) return [];

  const url = `${PHOTON_BASE}/?q=${encodeURIComponent(query)}&limit=6&lang=en`;

  try {
    const resp = await fetch(url, { signal });
    if (!resp.ok) return [];

    const data: { features: PhotonFeature[] } = await resp.json();

    return data.features.map((f) => {
      const { displayName, subtitle } = buildLabel(f.properties);
      return {
        displayName,
        subtitle,
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        osm_value: f.properties.osm_value || f.properties.type || "place",
      };
    });
  } catch {
    // AbortError or network failure — return empty silently
    return [];
  }
}
