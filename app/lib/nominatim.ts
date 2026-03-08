// Prefer a server-only key; fall back to the public key if not set
const API_KEY = process.env.GOOGLE_MAPS_SERVER_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const GEOCODE_BASE = "https://maps.googleapis.com/maps/api/geocode/json";

export interface GeocodedLocation {
  lat: number;
  lng: number;
  displayName: string;
}

/** Match strings like "-34.9285,138.6007" or "40.7128, -74.0060" */
const COORD_RE = /^(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/;

/**
 * Geocode a free-text address via Google Geocoding API.
 * If the string looks like a "lat,lng" coordinate pair, uses reverse geocoding.
 * Returns null if no result found or the request fails.
 */
export async function geocode(
  address: string
): Promise<GeocodedLocation | null> {
  const coordMatch = address.trim().match(COORD_RE);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return reverseGeocode(lat, lng);
  }
  return forwardGeocode(address);
}

async function forwardGeocode(address: string): Promise<GeocodedLocation | null> {
  const url = `${GEOCODE_BASE}?address=${encodeURIComponent(address)}&key=${API_KEY}`;

  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!resp.ok) {
      console.error("[geocode] HTTP error:", resp.status);
      return null;
    }
    const data: {
      status: string;
      results: Array<{
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
      }>;
    } = await resp.json();

    if (data.status !== "OK" || !data.results.length) return null;

    const r = data.results[0];
    return {
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
      displayName: r.formatted_address,
    };
  } catch (err) {
    console.error("[geocode] fetch error:", err);
    return null;
  }
}

async function reverseGeocode(lat: number, lng: number): Promise<GeocodedLocation | null> {
  const url = `${GEOCODE_BASE}?latlng=${lat},${lng}&key=${API_KEY}`;

  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!resp.ok) {
      console.error("[geocode] reverse HTTP error:", resp.status);
      return null;
    }
    const data: {
      status: string;
      results: Array<{
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
      }>;
    } = await resp.json();

    if (data.status !== "OK" || !data.results.length) return null;

    const r = data.results[0];
    return {
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
      displayName: r.formatted_address,
    };
  } catch (err) {
    console.error("[geocode] reverse fetch error:", err);
    return null;
  }
}
