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

// ─── Simple in-memory rate limiter (5 requests/min per IP) ───────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (entry.count >= 10) return true;
  entry.count++;
  return false;
}

// Prune stale entries periodically to avoid memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 5 * 60_000);

// ─── Anthropic client singleton ───────────────────────────────────────────────

let _anthropic: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

// ─── AI helper ────────────────────────────────────────────────────────────────

async function callAI(
  routes: ScoredRoute[],
  startName: string,
  endName: string
): Promise<AIExplanation | null> {
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
    friendlyRoads: r.signals.friendlyRoadCount,
    trafficCalming: r.signals.trafficCalmingCount,
    hostileRoads: r.signals.hostileRoadCount,
    roughSurfaces: r.signals.roughSurfaceCount,
    elevationGainM: r.elevationGainM ?? null,
    partialData: r.signals.partial,
  }));

  const prompt = `You are a friendly cycling route advisor helping someone find their happiest bike route.

Route: ${startName} → ${endName}

Candidate routes scored from OpenStreetMap data:
${JSON.stringify(summary, null, 2)}

The Happy Score (0–100) reflects: parks, water features, dedicated cycleways, green spaces, street lighting, separated cycle tracks, and friendly roads (living streets, bicycle roads) per km — minus penalties for hostile traffic roads, rough surfaces, and steep elevation gain.

Task:
1. Confirm or select the best "Happy Route" (highest score is a good default, but use judgement based on all factors).
2. Write 2–4 short, friendly, specific bullet points explaining WHY it's the happy route (mention specific features like lighting, separated lanes, parks, or traffic stress if notable).
3. If data suggests interesting stops (parks, riverside paths, café areas near the route), add 1–3 "suggestedStops".

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
      const mod = (await new Function("pkg", "return import(pkg)")("openai")) as OpenAIModule;
      const client = new mod.default({ apiKey });
      const res = await client.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 450,
        temperature: 0.3,
        messages: [{ role: "user", content: prompt }],
      });
      return validateAIResponse(JSON.parse(stripFences(res.choices[0].message.content ?? "")));
    }

    // Default: Anthropic
    const msg = await getAnthropicClient().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 450,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    return validateAIResponse(JSON.parse(stripFences(text)));
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

function validateAIResponse(raw: unknown): AIExplanation | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.bestRouteId !== "number") return null;
  if (!Array.isArray(obj.bullets) || obj.bullets.length === 0) return null;
  return {
    bestRouteId: obj.bestRouteId,
    bullets: (obj.bullets as unknown[]).filter((b) => typeof b === "string") as string[],
    suggestedStops: Array.isArray(obj.suggestedStops)
      ? (obj.suggestedStops as unknown[]).filter((s) => typeof s === "string") as string[]
      : [],
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute before trying again." },
      { status: 429 }
    );
  }

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
      console.warn("[navigate] could not parse Google Maps URL, falling back to manual inputs");
    }
  }

  if (!startAddress || !endAddress) {
    return NextResponse.json(
      { error: "Please provide both a start and end location." },
      { status: 400 }
    );
  }

  // ── 1. Geocode ──────────────────────────────────────────────────────────────
  type GeoResult = { lat: number; lng: number; displayName: string };

  async function resolveLocation(
    address: string,
    preCoords?: { lat: number; lng: number }
  ): Promise<GeoResult | null> {
    if (preCoords) {
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
      { error: `Could not find location: "${startAddress}". Try selecting from the autocomplete suggestions.` },
      { status: 400 }
    );
  }
  if (!endGeo) {
    return NextResponse.json(
      { error: `Could not find location: "${endAddress}". Try selecting from the autocomplete suggestions.` },
      { status: 400 }
    );
  }

  // ── 2. Resolve optional via-point ──────────────────────────────────────────
  let viaCoords: { lat: number; lng: number } | undefined;
  if (body.via?.text?.trim()) {
    const viaGeo = body.via.coords
      ? { lat: body.via.coords.lat, lng: body.via.coords.lng, displayName: body.via.text }
      : await geocode(body.via.text.trim());
    if (viaGeo) {
      viaCoords = { lat: viaGeo.lat, lng: viaGeo.lng };
      console.log(`[navigate] via-point resolved: ${body.via.text} → ${viaGeo.lat},${viaGeo.lng}`);
    }
  }

  // ── 3. Fetch routes from OSRM ───────────────────────────────────────────────
  let osrmRoutes;
  try {
    osrmRoutes = await getBikeRoutes(
      { lat: startGeo.lat, lng: startGeo.lng },
      { lat: endGeo.lat, lng: endGeo.lng },
      viaCoords
    );
  } catch (err) {
    console.error("[navigate] OSRM error:", err);
    return NextResponse.json(
      { error: "Could not fetch routes. The routing service may be temporarily unavailable." },
      { status: 502 }
    );
  }

  if (!osrmRoutes.length) {
    return NextResponse.json(
      { error: "No routes found between these locations." },
      { status: 404 }
    );
  }

  // ── 4. Score each route (parallel Overpass + elevation) ─────────────────────
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

  scoredRoutes.sort((a, b) => b.happyScore - a.happyScore);

  // ── 5. AI explanation ───────────────────────────────────────────────────────
  const shorten = (name: string) => name.split(",").slice(0, 2).join(",").trim();
  const startName = shorten(startGeo.displayName);
  const endName   = shorten(endGeo.displayName);

  console.log("[navigate] calling AI for explanation…");
  const explanation = await callAI(scoredRoutes, startName, endName);

  const validIds = scoredRoutes.map((r) => r.id);
  const bestRouteId =
    explanation && validIds.includes(explanation.bestRouteId)
      ? explanation.bestRouteId
      : scoredRoutes[0].id;

  return NextResponse.json(
    {
      routes: scoredRoutes,
      bestRouteId,
      explanation,
      startCoords: { lat: startGeo.lat, lng: startGeo.lng },
      endCoords: { lat: endGeo.lat, lng: endGeo.lng },
      startName,
      endName,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    }
  );
}
