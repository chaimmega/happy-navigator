const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

const HEADERS = {
  "User-Agent": "HappyNavigator/1.0 (opensource demo)",
  Accept: "application/json",
};

export interface GeocodedLocation {
  lat: number;
  lng: number;
  displayName: string;
}

/** Match strings like "-34.9285,138.6007" or "40.7128, -74.0060" */
const COORD_RE = /^(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/;

/**
 * Geocode a free-text address via Nominatim (OSM).
 * If the string looks like a "lat,lng" coordinate pair, uses the /reverse
 * endpoint instead of /search (handles parsed Google Maps coordinate URLs).
 * Returns null if no result found or the request fails.
 */
export async function geocode(
  address: string
): Promise<GeocodedLocation | null> {
  const coordMatch = address.trim().match(COORD_RE);
  if (coordMatch) {
    return reverseGeocode(parseFloat(coordMatch[1]), parseFloat(coordMatch[2]));
  }
  return forwardGeocode(address);
}

async function forwardGeocode(address: string): Promise<GeocodedLocation | null> {
  const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=0`;

  try {
    const resp = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 }, // geocoded addresses rarely change
    } as RequestInit);
    if (!resp.ok) {
      console.error("[nominatim] HTTP error:", resp.status);
      return null;
    }
    const data: Array<{ lat: string; lon: string; display_name: string }> = await resp.json();
    if (!data.length) return null;
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    };
  } catch (err) {
    console.error("[nominatim] fetch error:", err);
    return null;
  }
}

async function reverseGeocode(lat: number, lng: number): Promise<GeocodedLocation | null> {
  const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json`;

  try {
    const resp = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!resp.ok) {
      console.error("[nominatim] reverse HTTP error:", resp.status);
      return null;
    }
    const data: { lat: string; lon: string; display_name: string; error?: string } =
      await resp.json();
    if (data.error) return null;
    return {
      lat: parseFloat(data.lat),
      lng: parseFloat(data.lon),
      displayName: data.display_name,
    };
  } catch (err) {
    console.error("[nominatim] reverse fetch error:", err);
    return null;
  }
}
