# Happy Navigator

> Find the happiest driving route between two locations — scored by scenic roads, parks, waterfront, greenery, low traffic, and pleasant surroundings.

![Happy Navigator screenshot](docs/screenshot.png)

---

## What it does

Given a **start** and **destination** (or a pasted Google Maps directions URL), Happy Navigator:

1. **Geocodes** both addresses via Google Geocoding API (server-side).
2. **Fetches 2–3 driving route alternatives** from Google Directions API.
3. **Scores each route** by querying [OpenStreetMap Overpass API](https://overpass-api.de/) for:
   - Parks & gardens (`leisure=park`)
   - Green land-use (forests, meadows, woodland)
   - Waterfront features (rivers, lakes, coastline)
   - Scenic roads (secondary, tertiary, unclassified — quieter roads)
   - Low-traffic segments (residential, living streets)
   - Viewpoints (`tourism=viewpoint`)
   - Rest stops (rest areas, cafés, picnic sites)
   - Street lighting (`lit=yes`)
   - **Construction zones penalty** (road construction)
   - **Highway penalty** (motorway/trunk road segments — stressful driving)
4. **Fetches elevation data** via [OpenTopoData SRTM 30m](https://www.opentopodata.org/) (50 sample points for accurate profiles).
5. **Calls an LLM once** (Anthropic Claude Haiku) with a compact JSON summary to confirm the best route and explain why.
6. **Displays everything** on an interactive Google Map with a detailed side panel.

**Only the AI explanation and Google APIs require API keys.**

---

## Architecture

```
Browser
  └── Next.js 15 App Router (React + Tailwind)
        ├── app/page.tsx              — main UI (responsive, metric toggle, map pins)
        ├── app/components/
        │     ├── SearchForm.tsx      — address / Google Maps URL input + recent searches
        │     ├── MapView.tsx         — Google Maps (route polylines, markers, fit bounds)
        │     ├── RoutePanel.tsx      — route cards, scores, GPX export, AI explanation
        │     ├── ElevationProfile.tsx — SVG elevation chart (metric/imperial)
        │     └── HappyScore.tsx      — score badge component
        └── app/api/
              ├── navigate/route.ts   — POST handler (full scoring pipeline, rate limiting)
              └── reverse/route.ts    — GET handler (reverse geocode for map clicks)
                    ├── lib/nominatim.ts    — geocoding via Google Geocoding API
                    ├── lib/osrm.ts         — driving routes via Google Directions API
                    ├── lib/overpass.ts     — OSM feature queries (fallback servers)
                    ├── lib/elevation.ts    — elevation via OpenTopoData SRTM 30m
                    ├── lib/happiness.ts    — weighted scoring formula
                    └── lib/parseGoogleMapsUrl.ts
```

---

## Local Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- An **Anthropic API key** (get one at [console.anthropic.com](https://console.anthropic.com/settings/keys))
- A **Google Maps API key** (enable Geocoding, Directions, Maps JS, and Places APIs)

### 1 — Clone and install

```bash
git clone https://github.com/chaimmega/happy-navigator
cd happy-navigator
npm install
```

### 2 — Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
# GOOGLE_MAPS_SERVER_KEY=...   # optional: separate key for server-side calls
```

**Using OpenAI instead?**

```bash
npm install openai
```

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

### 3 — Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> First search takes 15–20 seconds — geocoding + routing + Overpass + elevation + AI all run in parallel.

---

## Usage

**Type addresses:**
1. Enter start/destination (autocomplete via Google Places)
2. Use GPS button for current location
3. Click swap button to swap start and destination
4. Click **Find Happy Routes**

**Paste a Google Maps URL:**
- `https://www.google.com/maps/dir/Central+Park/Brooklyn+Bridge`
- `https://www.google.com/maps/dir/?api=1&origin=...&destination=...`

**Map pin mode (desktop):**
- Click **Pin start** or **Pin end** in the header to set locations by clicking the map

**Units:** Toggle km/mi in the header (preference saved in localStorage)

**Export:** Click **Export GPX** on the selected route to download for GPS devices

**Shareable links:** URL updates with coords after each search — share or bookmark it

**Recent searches:** Stored locally — click "Recent searches" below the form

---

## Happy Score formula

```
score = 5 (base)
      + min((parks       / km) × 12, 30)   ← up to 30 pts
      + min((scenicRoads / km) × 10, 25)   ← up to 25 pts (scenic roads)
      + min((waterfront  / km) × 8,  20)   ← up to 20 pts (waterfront areas)
      + min((green       / km) × 5,  15)   ← up to 15 pts
      + min((lowTraffic  / km) × 6,  15)   ← up to 15 pts (low-traffic roads)
      + min((lit         / km) × 4,  10)   ← up to 10 pts
      + min((restStops   / km) × 3,   8)   ← up to  8 pts (rest areas, cafés)
      + min((viewpoints  / km) × 2,   5)   ← up to  5 pts (scenic viewpoints)
      − min((construction / km) × 5, 15)   ← up to −15 pts (construction zones)
      − min((elevation   / km) × 3,  20)   ← up to −20 pts (steep terrain)
      − min((highway     / km) × 4,  12)   ← up to −12 pts (motorway segments)
```

All counts normalised per km. Final score clamped to 0–100.

To adjust weights, edit `app/lib/happiness.ts` only.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v3 |
| Map | Google Maps JS API |
| Geocoding | Google Geocoding API (server-side) |
| Places | Google Places Autocomplete (client-side) |
| Routing | Google Directions API (driving mode) |
| OSM data | Overpass API (with fallback to overpass.kumi.systems) |
| Elevation | OpenTopoData SRTM 30m (50 sample points) |
| AI | Anthropic Claude Haiku (~$0.001/search) |

---

## API endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/navigate` | POST | Full pipeline: geocode → route → score → AI |
| `/api/reverse` | GET | Reverse geocode `?lat=&lng=` for map pin mode |

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `AI_PROVIDER` | No | `anthropic` | `anthropic` or `openai` |
| `ANTHROPIC_API_KEY` | If anthropic | — | Anthropic API key |
| `OPENAI_API_KEY` | If openai | — | OpenAI API key |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Yes | — | Google Maps JS API + Places (client) |
| `GOOGLE_MAPS_SERVER_KEY` | No | — | Separate key for Geocoding + Directions (server) |

---

## Limitations

- **Overpass API** rate-limits heavy usage. Conservative query: 10 sampled points, 250 m radius.
- **Rate limiting**: 10 requests/minute per IP (in-memory, resets on server restart).
- **Google Maps shortened URLs** (`maps.app.goo.gl`) can't be parsed client-side — use the fallback address fields.
- The Happy Score is a heuristic proxy. Real-world conditions (road closures, live traffic) aren't reflected.

---

## License

MIT
