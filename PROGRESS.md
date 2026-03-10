# Happy Navigator — Complete Project Status

**Last updated:** 2026-03-10
**GitHub:** https://github.com/chaimmega/happy-navigator
**GitHub account:** chaimmega
**Status:** MVP complete, driving route mode

---

## How to Resume a Session

```bash
cd happy-navigator
claude --dangerouslySkipPermissions
```

Claude loads memory from `.claude/projects/.../memory/MEMORY.md` automatically.
Tell Claude: **"Check PROGRESS.md and continue"**

---

## How to Run the App

```bash
npm run dev          # http://localhost:3000
npm run build        # production build + type-check (0 errors)
npx tsc --noEmit     # type-check only
npm run lint         # ESLint
```

`.env.local` already exists locally with real API keys. Do not commit it.

**Node.js v18 or later required.** (Check: `node --version`)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 App Router + TypeScript strict mode |
| Styling | Tailwind CSS v3 — utilities only, no custom CSS beyond globals.css |
| Map | Google Maps JS API — always loaded via `dynamic(..., { ssr: false })` |
| Routing | Google Directions API — driving mode, up to 3 alternatives |
| Geocoding | Google Geocoding API (server-side, cached 24h) |
| Autocomplete | Google Places Autocomplete (client-side, session tokens) |
| OSM signals | Overpass API — parks, scenic roads, waterfront, viewpoints, rest stops |
| Elevation | OpenTopoData SRTM 30m — 50 sample points per route |
| AI | Claude Haiku `claude-haiku-4-5-20251001` via `@anthropic-ai/sdk` |

---

## Complete File Map

```
happy-navigator/
├── app/
│   ├── api/navigate/
│   │   └── route.ts              Server pipeline: geocode → route → score → AI
│   ├── api/reverse/
│   │   └── route.ts              GET handler: reverse geocode for map clicks
│   ├── components/
│   │   ├── GoogleMapsProvider.tsx Loads Google Maps JS API globally with Places
│   │   ├── HappyScore.tsx        Score badge: emoji + number, color by threshold
│   │   ├── MapView.tsx           Google Maps: polylines, markers, fit bounds
│   │   ├── PlaceAutocomplete.tsx Google Places Autocomplete with session tokens
│   │   ├── RouteCard.tsx         Route card with signals, breakdown, GPX export
│   │   ├── RoutePanel.tsx        Route cards, scores, AI explanation panel
│   │   ├── ElevationProfile.tsx  SVG elevation chart (metric/imperial)
│   │   ├── LoadingSteps.tsx      Pipeline progress indicator
│   │   └── SearchForm.tsx        Address / Google Maps URL input + recent searches
│   ├── lib/
│   │   ├── constants.ts          ROUTE_COLORS + ROUTE_NAMES
│   │   ├── happiness.ts          computeHappyScore() — weighted 0–100 formula
│   │   ├── lruCache.ts           Shared LRU cache utility
│   │   ├── nominatim.ts          geocode() — Google Geocoding API
│   │   ├── osrm.ts               getDrivingRoutes() — Google Directions, driving mode
│   │   ├── overpass.ts           getHappinessSignals() — 10-point sample, 250m radius
│   │   ├── elevation.ts          getRouteElevation() — OpenTopoData, 50 samples
│   │   └── parseGoogleMapsUrl.ts Parses /maps/dir/ and ?api=1&origin= URLs
│   ├── types/
│   │   └── index.ts              All shared TypeScript interfaces
│   ├── globals.css               Tailwind base + custom styles
│   ├── layout.tsx                HTML shell + metadata
│   └── page.tsx                  Main page: form, loading, map, results
├── e2e/                          Playwright e2e + integration tests
├── docs/                         Project documentation
├── CLAUDE.md                     Architecture rules for Claude Code
├── README.md                     Setup guide + run instructions
└── PROGRESS.md                   This file
```

---

## Server Pipeline (`app/api/navigate/route.ts`)

`POST /api/navigate` — all external API calls are server-side only.

```
1. Parse request body (NavigateRequest)
2. If googleMapsUrl provided → parseGoogleMapsUrl()
3. resolveLocation() for start + end (parallel):
   - If pre-resolved coords present → use directly, skip geocoding
   - Otherwise → Google Geocoding API
4. getDrivingRoutes() via Google Directions → up to 3 driving alternatives
5. getHappinessSignals() for each route via Overpass (parallel)
6. getRouteElevation() for each route via OpenTopoData (parallel)
7. computeHappyScore() for each route → { score, breakdown }
8. Sort routes descending by happyScore
9. callAI() → 1 Claude Haiku call, max 450 tokens, returns JSON
10. Validate AI bestRouteId; fall back to routes[0].id if invalid
11. Return NavigateResponse JSON
```

---

## Happy Score Formula (`app/lib/happiness.ts`)

```
score = 5 (base, always)
      + min((parkCount        / distKm) * 12,  30)   parks        → up to 30 pts
      + min((scenicRoadCount  / distKm) * 10,  25)   scenic roads → up to 25 pts
      + min((waterfrontCount  / distKm) *  8,  20)   waterfront   → up to 20 pts
      + min((greenCount       / distKm) *  5,  15)   green        → up to 15 pts
      + min((lowTrafficCount  / distKm) *  6,  15)   low traffic  → up to 15 pts
      + min((litCount         / distKm) *  4,  10)   lit          → up to 10 pts
      + min((restStopCount    / distKm) *  3,   8)   rest stops   → up to  8 pts
      + min((viewpointCount   / distKm) *  2,   5)   viewpoints   → up to  5 pts
      - min((constructionCount / distKm) * 5,  15)   construction → up to -15 pts
      - min((elevationGainM   / distKm) *  3,  20)   elevation    → up to -20 pts
      - min((highwayCount     / distKm) *  4,  12)   highway      → up to -12 pts
      [final score clamped to 0–100]
      [× 0.85 if partial data, floor 5]
```

- Distance normalised to minimum 0.5 km to prevent division by near-zero

**What Overpass counts:**
- Parks: `leisure=park`, `leisure=garden`
- Green: `landuse=forest/grass/meadow/village_green`, `natural=wood/scrub/heath`
- Waterfront: `natural=water`, `natural=coastline`, `waterway=river/canal/riverbank`
- Scenic roads: `highway=secondary/tertiary/unclassified`
- Low traffic: `highway=residential/living_street`
- Viewpoints: `tourism=viewpoint`
- Rest stops: `amenity=rest_area/cafe/picnic_site`, `highway=rest_area`
- Construction: `highway=construction` (penalty)
- Highway: `highway=motorway/trunk` (penalty)

**Sampling:** 10 points evenly distributed along the route (always includes first and last).
**Radius:** 250m around each sample point. One compound Overpass query per route.

---

## Critical Architecture Rules

| Rule | Reason |
|---|---|
| MapView must be `dynamic(..., { ssr: false })` | Google Maps JS API requires browser DOM |
| GoogleMapsProvider wraps entire app | Loads Maps script once with Places library |
| Geometry is `[lng, lat]` everywhere | GeoJSON order — only swap to `{ lat, lng }` inside MapView |
| Overpass must never throw | Always return `partial: true` on failure so routes still render |
| All external API calls server-side only | Never call Overpass, Directions, Geocoding, or AI from browser |
| One AI call per search | Haiku max 450 tokens — keep cheap (~$0.001/search) |
| AI is explanation-only | `bestRouteId` always equals `scoredRoutes[0].id` — AI never overrides |

---

## Environment Variables

```env
# .env.local (exists locally, NOT committed)
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
# GOOGLE_MAPS_SERVER_KEY=...          # optional: separate server key
# OPENAI_API_KEY=sk-...               # only if AI_PROVIDER=openai
```

---

## License

MIT
