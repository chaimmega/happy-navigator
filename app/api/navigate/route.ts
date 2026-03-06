import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Allow up to 30 s on Vercel (default is 10 s, too short for our pipeline)
export const maxDuration = 30;
export const runtime = "nodejs";
import { geocode } from "../../lib/nominatim";
import { getBikeRoutes } from "../../lib/osrm";
import { getHappinessSignals } from "../../lib/overpass";
import { getRouteElevation } from "../../lib/elevation";
import { computeHappyScore } from "../../lib/happiness";
import { parseGoogleMapsUrl } from "../../lib/parseGoogleMapsUrl";
import type { NavigateRequest, ScoredRoute, AIExplanation } from "../../types";

// Lazy singleton — avoids re-instantiating on every request in local dev
let _anthropic: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

// ─── AI helper ───────────────────────────────────────────────────────────────

async function callAI(routes: ScoredRoute[]): Promise<AIExplanation | null> {
  const provider = process.env.AI_PROVIDER ?? "anthropic";

  const summary = routes.slice(0, 3).map((r) => ({
    id: r.id,
    distanceKm: (r.distance / 1000).toFixed(1),
    durationMin: Math.round(r.duration / 60),
    happyScore: r.happyScore,
    parks: r.signals.parkCount,
    water: r.signals.waterCount,
    cycleways: r.signals.cyclewayCount,
    greenSpaces: r.signals.greenCount,
    litSegments: r.signals.litCount,
    separatedTracks: r.signals.segregatedCount,
    roughSurfaces: r.signals.roughSurfaceCount,
    elevationGainM: r.elevationGainM ?? null,
    partialData: r.signals.partial,
  }));

  const prompt = `You are a friendly cycling route advisor helping someone find their happiest bike route.

Here are the candidate routes, scored automatically from OpenStreetMap data:
${JSON.stringify(summary, null, 2)}

The Happy Score (0–100) reflects nearby parks, water features, dedicated cycleways, green spaces, street lighting, and physically separated cycle tracks per km — minus penalties for rough surfaces and steep elevation gain.

Task:
1. Confirm or select the best "Happy Route" (highest score is a good default, but use judgement).
2. Write 2–4 short, friendly, specific bullet points explaining WHY it's the happy route (mention lighting, surface quality, or elevation if notable).
3. If the data suggests interesting stops (parks, riverside, café areas), add 1–3 "suggestedStops".

Respond with ONLY valid JSON — no markdown fences, no extra text:
{
  "bestRouteId": <number>,
  "bullets": ["<bullet 1>", "<bullet 2>", "..."],
  "suggestedStops": ["<stop 1>", "..."]
}`;

  try {
    if (provider === "openai") {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.error("[ai] OPENAI_API_KEY is not set");
        return null;
      }
      // openai is optional — install with: npm install openai
      // Dynamic import via Function() prevents Next.js from bundling it and
      // emitting a "module not found" warning when it isn't installed.
      type OpenAIModule = {
        default: new (opts: { apiKey: string }) => {
          chat: {
            completions: {
              create: (opts: unknown) => Promise<{
                choices: Array<{ message: { content: string } }>;
              }>;
            };
          };
        };
      };
      // eslint-disable-next-line no-new-func
      const mod = (await new Function("pkg", "return import(pkg)")(
        "openai"
      )) as OpenAIModule;
      const client = new mod.default({ apiKey });
      const res = await client.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 450,
        temperature: 0.7,
        messages: [{ role: "user", content: prompt }],
      });
      return JSON.parse(stripFences(res.choices[0].message.content ?? ""));
    }

    // Default: Anthropic
    const msg = await getAnthropicClient().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 450,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    return JSON.parse(stripFences(text));
  } catch (err) {
    console.error("[ai] call failed:", err);
    return null;
  }
}

function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: NavigateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  let startAddress = body.start?.trim();
  let endAddress = body.end?.trim();

  // Try to parse Google Maps URL first
  if (body.googleMapsUrl?.trim()) {
    const parsed = parseGoogleMapsUrl(body.googleMapsUrl.trim());
    if (parsed?.start && parsed?.end) {
      console.log("[navigate] parsed Google Maps URL:", parsed);
      startAddress = parsed.start;
      endAddress = parsed.end;
    } else {
      console.warn(
        "[navigate] could not parse Google Maps URL, falling back to manual inputs"
      );
    }
  }

  if (!startAddress || !endAddress) {
    return NextResponse.json(
      { error: "Please provide both a start and end location." },
      { status: 400 }
    );
  }

  // ── 1. Geocode (skip if pre-resolved coords from Photon autocomplete) ──────
  type GeoResult = { lat: number; lng: number; displayName: string };

  async function resolveLocation(
    address: string,
    preCoords?: { lat: number; lng: number }
  ): Promise<GeoResult | null> {
    if (preCoords) {
      // Coords already resolved client-side via Photon — use address as display name
      return { lat: preCoords.lat, lng: preCoords.lng, displayName: address };
    }
    return geocode(address);
  }

  console.log(`[navigate] resolving: "${startAddress}" → "${endAddress}"`);
  const [startGeo, endGeo] = await Promise.all([
    resolveLocation(startAddress, body.startCoords),
    resolveLocation(endAddress, body.endCoords),
  ]);

  if (!startGeo) {
    return NextResponse.json(
      {
        error: `Could not find location: "${startAddress}". Try selecting from the autocomplete suggestions.`,
      },
      { status: 400 }
    );
  }
  if (!endGeo) {
    return NextResponse.json(
      {
        error: `Could not find location: "${endAddress}". Try selecting from the autocomplete suggestions.`,
      },
      { status: 400 }
    );
  }

  // ── 2. Fetch routes from OSRM ──────────────────────────────────────────────
  let osrmRoutes;
  try {
    osrmRoutes = await getBikeRoutes(
      { lat: startGeo.lat, lng: startGeo.lng },
      { lat: endGeo.lat, lng: endGeo.lng }
    );
  } catch (err) {
    console.error("[navigate] OSRM error:", err);
    return NextResponse.json(
      {
        error:
          "Could not fetch routes. The routing service may be temporarily unavailable.",
      },
      { status: 502 }
    );
  }

  if (!osrmRoutes.length) {
    return NextResponse.json(
      { error: "No routes found between these locations." },
      { status: 404 }
    );
  }

  // ── 3. Score each route (parallel Overpass + elevation queries) ─────────────
  console.log(`[navigate] scoring ${osrmRoutes.length} route(s) via Overpass + elevation…`);
  const scoredRoutes: ScoredRoute[] = await Promise.all(
    osrmRoutes.map(async (route, i) => {
      const [signals, elevResult] = await Promise.all([
        getHappinessSignals(route.geometry.coordinates),
        getRouteElevation(route.geometry.coordinates),
      ]);
      const distanceKm = route.distance / 1000;
      const { score: happyScore, breakdown: scoreBreakdown } = computeHappyScore(
        signals,
        distanceKm,
        elevResult?.gainM
      );
      console.log(`[navigate] route ${i}: score=${happyScore}, elevGain=${elevResult?.gainM ?? "n/a"}m, signals=`, signals);
      return {
        id: i,
        geometry: route.geometry.coordinates,
        distance: route.distance,
        duration: route.duration,
        signals,
        happyScore,
        scoreBreakdown,
        elevationGainM: elevResult?.gainM,
        elevationPoints: elevResult?.elevationPoints,
      };
    })
  );

  // Sort descending by happy score
  scoredRoutes.sort((a, b) => b.happyScore - a.happyScore);

  // ── 4. AI explanation (single call) ───────────────────────────────────────
  console.log("[navigate] calling AI for explanation…");
  const explanation = await callAI(scoredRoutes);

  // Validate bestRouteId from AI; fall back to top-scored route
  const validIds = scoredRoutes.map((r) => r.id);
  const bestRouteId =
    explanation && validIds.includes(explanation.bestRouteId)
      ? explanation.bestRouteId
      : scoredRoutes[0].id;

  // Shorten display names to "Place, City" style
  const shorten = (name: string) => name.split(",").slice(0, 2).join(",").trim();

  return NextResponse.json(
    {
      routes: scoredRoutes,
      bestRouteId,
      explanation,
      startCoords: { lat: startGeo.lat, lng: startGeo.lng },
      endCoords: { lat: endGeo.lat, lng: endGeo.lng },
      startName: shorten(startGeo.displayName),
      endName: shorten(endGeo.displayName),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    }
  );
}
