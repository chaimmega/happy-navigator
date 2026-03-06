/**
 * Attempts to extract start and end addresses from a Google Maps directions URL.
 *
 * Supported formats:
 *   1. /maps/dir/Start+Address/End+Address/@lat,lng,zoom
 *   2. /maps/dir/?api=1&origin=Start&destination=End
 *
 * Shortened URLs (maps.app.goo.gl) cannot be parsed without following the redirect.
 * Returns null when parsing fails — the caller should fall back to manual input.
 */
export function parseGoogleMapsUrl(
  url: string
): { start?: string; end?: string } | null {
  try {
    const u = new URL(url);

    if (!u.hostname.includes("google.com")) {
      return null;
    }

    // Format 2 — query params (Maps Embed API style)
    const origin = u.searchParams.get("origin");
    const destination = u.searchParams.get("destination");
    if (origin && destination) {
      return { start: origin, end: destination };
    }

    // Format 1 — path segments after /maps/dir/
    const match = u.pathname.match(/\/maps\/dir\/(.*)/);
    if (match) {
      // Split on "/" and discard empty segments and the zoom anchor (starts with @)
      const parts = match[1]
        .split("/")
        .map((p) => decodeURIComponent(p).replace(/\+/g, " ").trim())
        .filter((p) => p && !p.startsWith("@"));

      if (parts.length >= 2) {
        return { start: parts[0], end: parts[parts.length - 1] };
      }
    }

    return null;
  } catch {
    return null;
  }
}
