# Happy Navigator — Claude Code Instructions

## Project overview

Next.js 15 (App Router) + TypeScript + Tailwind web app that scores **driving routes** for "happiness" using Google Maps APIs, OpenStreetMap Overpass for feature detection, and a single Claude Haiku AI call per search. It finds more enjoyable driving routes between two places, prioritizing scenic roads, calmer traffic, greenery, waterfronts, and pleasant surroundings instead of only the fastest route.

## Common commands

```bash
npm run dev       # start dev server at http://localhost:3000
npm run build     # production build (also runs type-check)
npx tsc --noEmit  # type-check only, no build
npm run lint      # ESLint
```

## Key file locations

| File | Purpose |
|---|---|
| `app/api/navigate/route.ts` | **Main server pipeline** — geocode → Directions → Overpass → score → AI |
| `app/lib/osrm.ts` | Driving routes via Google Directions API (server-side, driving mode) |
| `app/lib/overpass.ts` | OSM feature queries — parks, scenic roads, waterfront, viewpoints, rest stops |
| `app/lib/happiness.ts` | Weighted 0–100 scoring formula |
| `app/lib/nominatim.ts` | Geocoding via Google Geocoding API (server-side) |
| `app/lib/parseGoogleMapsUrl.ts` | Parse Google Maps directions URLs |
| `app/components/MapView.tsx` | Google Maps — always loaded via `dynamic(..., { ssr: false })` |
| `app/components/GoogleMapsProvider.tsx` | Loads Google Maps JS API globally with Places library |
| `app/components/PlaceAutocomplete.tsx` | Google Places Autocomplete with session tokens |
| `app/types/index.ts` | All shared TypeScript interfaces |

## Architecture rules

- **All external API calls must be server-side** (`app/api/` or `app/lib/`). Never call Overpass, Directions, Geocoding, or the AI from browser code. Only Places Autocomplete runs client-side (it requires the Maps JS API).
- **MapView must remain client-only** — Google Maps JS API doesn't support SSR. The `dynamic(() => import('./components/MapView'), { ssr: false })` pattern in `page.tsx` is intentional; don't remove it.
- **GoogleMapsProvider wraps the entire app** — loads the Maps script once with the `places` library. Don't load the script elsewhere.
- **One AI call per search** — the `callAI()` in `route.ts` is the only place to call the LLM. Keep it cheap (Haiku, ≤500 tokens).
- **AI is explanation-only** — `bestRouteId` in the response is always `scoredRoutes[0].id` (the highest scorer after sorting). The AI's returned `bestRouteId` is ignored for route selection; only its `bullets` and `suggestedStops` are used. Never let AI override the numeric score ranking.
- **Partial data penalty** — routes with `signals.partial = true` receive a 15% score reduction (floor 5) in `happiness.ts`. This prevents incomplete OSM data from winning unfairly over fully-scored routes.
- **Overpass must degrade gracefully** — always return `{ ..., partial: true }` on timeout/error, never throw. Routes still display with partial scores.
- **Server-side caching** — geocoding (24h TTL, 500 entries) and routes (2h TTL, 200 entries) are cached in-memory LRU to reduce API costs.

## External API constraints

| API | Base URL | Key? | Timeout | Notes |
|---|---|---|---|---|
| Google Geocoding | `maps.googleapis.com/maps/api/geocode/json` | Yes | 8 s | Server-side, cached 24h |
| Google Directions | `maps.googleapis.com/maps/api/directions/json` | Yes | 15 s | Driving mode, cached 2h |
| Google Places | Client-side via Maps JS API | Yes (`NEXT_PUBLIC_`) | — | Uses session tokens for cost savings |
| Google Maps JS | Client-side | Yes (`NEXT_PUBLIC_`) | — | Loaded by GoogleMapsProvider |
| Overpass | `overpass-api.de/api/interpreter` | No | 14 s | Conservative use — 1 compound query per route |
| Anthropic | SDK | Yes (`ANTHROPIC_API_KEY`) | SDK default | Model: `claude-haiku-4-5-20251001` |

## Happy Score formula

```
score = 5 (base)
      + min((parks       / distKm) × 12,  30)   ← weights in happiness.ts
      + min((scenicRoads / distKm) × 10,  25)
      + min((waterfront  / distKm) × 8,   20)
      + min((green       / distKm) × 5,   15)
      + min((lowTraffic  / distKm) × 6,   15)
      + min((lit         / distKm) × 4,   10)
      + min((restStops   / distKm) × 3,    8)
      + min((viewpoints  / distKm) × 2,    5)
      - min((construction / distKm) × 5,  15)   ← penalties
      - min((elevation   / distKm) × 3,   20)
      - min((highway     / distKm) × 4,   12)
      × 0.85  if signals.partial = true          ← confidence penalty, floor 5
```

To adjust weights or penalties, edit `app/lib/happiness.ts` only — nowhere else.

## Code conventions

- **TypeScript strict mode** — no `any`, no `as unknown as X` hacks. All types live in `app/types/index.ts`.
- **No CSS files other than `globals.css`** — use Tailwind utility classes only.
- **Server lib functions are pure** — `nominatim.ts`, `osrm.ts`, `overpass.ts`, `happiness.ts` have no side-effects and no Next.js imports. Keep them that way so they're easy to unit-test.
- **Geometry coordinate order** — Directions API returns encoded polylines decoded to `[lat, lng]`, then swapped to `[lng, lat]` in `osrm.ts`. Google Maps uses `{ lat, lng }` objects. The swap to Google Maps format happens in `MapView.tsx`. Don't swap anywhere else.
- Route IDs are their 0-based index in the sorted `scoredRoutes` array (sorted descending by score). `bestRouteId` is always `scoredRoutes[0].id` — the top scorer. AI never overrides this.

## Environment variables

```bash
AI_PROVIDER=anthropic                        # or "openai"
ANTHROPIC_API_KEY=sk-ant-...                 # required for default provider
# OPENAI_API_KEY=sk-...                      # only if AI_PROVIDER=openai
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...          # Maps JS API + Places (client-exposed)
# GOOGLE_MAPS_SERVER_KEY=...                 # Optional: separate key for Geocoding + Directions (server-only)
```

## Relevant Claude Code skills

- **`/simplify`** — run after adding or changing features to review for unnecessary complexity. Especially useful on `overpass.ts` (query building) and `route.ts` (pipeline logic).
- **`/claude-api`** — auto-triggered when touching `app/api/navigate/route.ts` because it imports `@anthropic-ai/sdk`. Gives best-practice guidance for Anthropic SDK usage, prompt design, and token efficiency.
