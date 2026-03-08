# Happy Navigator — Claude Code Instructions

## Project overview

Next.js 15 (App Router) + TypeScript + Tailwind web app that scores canoe routes for "happiness" using free OpenStreetMap APIs and a single Claude Haiku AI call per search.

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
| `app/api/navigate/route.ts` | **Main server pipeline** — geocode → OSRM → Overpass → score → AI |
| `app/lib/osrm.ts` | Canoe routing via OSRM public server (free, no key) |
| `app/lib/overpass.ts` | OSM feature queries — parks, water, waterways, launches |
| `app/lib/happiness.ts` | Weighted 0–100 scoring formula |
| `app/lib/nominatim.ts` | Geocoding via Nominatim (free, no key) |
| `app/lib/parseGoogleMapsUrl.ts` | Parse Google Maps directions URLs |
| `app/components/MapView.tsx` | Leaflet map — always loaded via `dynamic(..., { ssr: false })` |
| `app/types/index.ts` | All shared TypeScript interfaces |

## Architecture rules

- **All external API calls must be server-side** (`app/api/` or `app/lib/`). Never call Overpass, OSRM, Nominatim, or the AI from browser code.
- **MapView must remain client-only** — Leaflet doesn't support SSR. The `dynamic(() => import('./components/MapView'), { ssr: false })` pattern in `page.tsx` is intentional; don't remove it.
- **One AI call per search** — the `callAI()` in `route.ts` is the only place to call the LLM. Keep it cheap (Haiku, ≤500 tokens).
- **Overpass must degrade gracefully** — always return `{ ..., partial: true }` on timeout/error, never throw. Routes still display with partial scores.

## External API constraints

| API | Base URL | Key? | Timeout | Notes |
|---|---|---|---|---|
| Nominatim | `nominatim.openstreetmap.org` | No | 8 s | Requires `User-Agent` header |
| OSRM | `router.project-osrm.org` | No | 15 s | Foot profile: `/route/v1/foot/` |
| Overpass | `overpass-api.de/api/interpreter` | No | 14 s | Conservative use — 1 compound query per route |
| Anthropic | SDK | Yes (`ANTHROPIC_API_KEY`) | SDK default | Model: `claude-haiku-4-5-20251001` |

## Happy Score formula

```
score = 5 (base)
      + min((parks     / distKm) × 12,  30)   ← weights in happiness.ts
      + min((waterways / distKm) × 10,  25)
      + min((water     / distKm) × 8,   20)
      + min((green     / distKm) × 5,   15)
```

To adjust weights, edit `app/lib/happiness.ts` only — nowhere else.

## Code conventions

- **TypeScript strict mode** — no `any`, no `as unknown as X` hacks. All types live in `app/types/index.ts`.
- **No CSS files other than `globals.css`** — use Tailwind utility classes only.
- **Server lib functions are pure** — `nominatim.ts`, `osrm.ts`, `overpass.ts`, `happiness.ts` have no side-effects and no Next.js imports. Keep them that way so they're easy to unit-test.
- **Geometry coordinate order** — OSRM and GeoJSON use `[lng, lat]`. Leaflet uses `[lat, lng]`. The swap happens in `MapView.tsx` when converting `route.geometry` to Leaflet positions. Don't swap anywhere else.
- Route IDs are their 0-based index in the sorted `scoredRoutes` array (sorted descending by score). `bestRouteId` is set by the AI or defaults to `scoredRoutes[0].id`.

## Environment variables

```bash
AI_PROVIDER=anthropic          # or "openai"
ANTHROPIC_API_KEY=sk-ant-...   # required for default provider
# OPENAI_API_KEY=sk-...        # only if AI_PROVIDER=openai (+ npm install openai)
```

## Relevant Claude Code skills

- **`/simplify`** — run after adding or changing features to review for unnecessary complexity. Especially useful on `overpass.ts` (query building) and `route.ts` (pipeline logic).
- **`/claude-api`** — auto-triggered when touching `app/api/navigate/route.ts` because it imports `@anthropic-ai/sdk`. Gives best-practice guidance for Anthropic SDK usage, prompt design, and token efficiency.
