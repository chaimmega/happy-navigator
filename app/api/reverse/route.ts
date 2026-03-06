import { NextRequest, NextResponse } from "next/server";
import { geocode } from "../../lib/nominatim";

export const runtime = "nodejs";

/**
 * GET /api/reverse?lat=...&lng=...
 * Reverse-geocodes a coordinate pair via Nominatim (server-side, no CORS issues).
 * Used by MapView when the user clicks the map to set a start/end location.
 */
export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json({ error: "Missing lat or lng" }, { status: 400 });
  }

  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  if (isNaN(latNum) || isNaN(lngNum)) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  // Reuse the server-side geocode function which handles "lat,lng" strings
  const result = await geocode(`${latNum},${lngNum}`);
  const fallback = `${latNum.toFixed(5)}, ${lngNum.toFixed(5)}`;

  if (!result) {
    return NextResponse.json({ name: fallback, lat: latNum, lng: lngNum });
  }

  const name = result.displayName.split(",").slice(0, 2).join(",").trim();
  return NextResponse.json(
    { name, lat: result.lat, lng: result.lng },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
