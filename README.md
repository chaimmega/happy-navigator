# Happy Navigator

> Find the happiest bike route between two locations — scored by parks, cycleways, water, lighting, traffic stress, and elevation.

![Happy Navigator screenshot](docs/screenshot.png)

---

## What it does

Given a **start** and **end** location (or a pasted Google Maps directions URL), Happy Navigator:

1. **Geocodes** both addresses via [Nominatim](https://nominatim.openstreetmap.org/) (free, no key).
2. **Fetches 2–3 route alternatives** from the [OSRM](http://project-osrm.org/) public bike routing server.
3. **Scores each route** by querying [OpenStreetMap Overpass API](https://overpass-api.de/) for:
   - Parks & gardens (`leisure=park`)
   - Green land-use (forests, meadows, woodland)
   - Water features (rivers, lakes, canals)
   - Dedicated cycle infrastructure (`highway=cycleway`, `cycleway=lane/track`, `cycleway:left/right=track`)
   - Street lighting (`lit=yes`)
   - **Friendly roads** (living streets, pedestrian areas, bicycle roads) — *new*
   - **Traffic calming** (speed bumps, tables, chicanes) — *new*
   - **Traffic stress penalty** (trunk/primary/motorway roads nearby) — *new*
   - Surface roughness penalty (gravel, cobblestone, dirt)
4. **Fetches elevation data** via [OpenTopoData SRTM 30m](https://www.opentopodata.org/) (50 sample points for accurate profiles).
5. **Calls an LLM once** (Anthropic Claude Haiku) with a compact JSON summary to confirm the best route and explain why.
6. **Displays everything** on an interactive Leaflet/OpenStreetMap map with a detailed side panel.

**All routing, geocoding, and map data are free and open.** Only the AI explanation requires an API key.

---

## Architecture

```
Browser
  └── Next.js 15 App Router (React + Tailwind)
        ├── app/page.tsx              — main UI (responsive, metric toggle, map pins)
        ├── app/components/
        │     ├── SearchForm.tsx      — address / Google Maps URL input + recent searches
        │     ├── MapView.tsx         — Leaflet map (CyclOSM tile toggle, map click handler)
        │     ├── RoutePanel.tsx      — route cards, scores, GPX export, AI explanation
        │     ├── ElevationProfile.tsx — SVG elevation chart (metric/imperial)
        │     └── HappyScore.tsx      — score badge component
        └── app/api/
              ├── navigate/route.ts   — POST handler (full scoring pipeline, rate limiting)
              └── reverse/route.ts    — GET handler (reverse geocode for map clicks)
                    ├── lib/nominatim.ts    — geocoding via Nominatim
                    ├── lib/osrm.ts         — bike routing via OSRM
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
1. Enter start/end (autocomplete via Photon/Komoot)
2. Use GPS button for current location
3. Click ⇅ to swap start and end
4. Click **Find Happy Routes**

**Paste a Google Maps URL:**
- `https://www.google.com/maps/dir/Central+Park/Brooklyn+Bridge`
- `https://www.google.com/maps/dir/?api=1&origin=...&destination=...`

**Map pin mode (desktop):**
- Click **📍 Pin start** or **📍 Pin end** in the header to set locations by clicking the map

**Units:** Toggle km/mi in the header (preference saved in localStorage)

**Tile layers:** Click the map layer button to switch between standard OpenStreetMap and **CyclOSM** (shows cycle infrastructure)

**Export:** Click **Export GPX** on the selected route to download for Garmin/Wahoo devices

**Shareable links:** URL updates with coords after each search — share or bookmark it

**Recent searches:** Stored locally — click "Recent searches" below the form

---

## Happy Score formula

```
score = 5 (base)
      + min((parks          / km) × 12, 30)   ← up to 30 pts
      + min((cycleways      / km) × 10, 25)   ← up to 25 pts
      + min((water          / km) × 8,  20)   ← up to 20 pts
      + min((green          / km) × 5,  15)   ← up to 15 pts
      + min((segregated     / km) × 6,  15)   ← up to 15 pts
      + min((friendlyRoads  / km) × 3,   8)   ← up to  8 pts  (living streets, bicycle roads)
      + min((lit            / km) × 4,  10)   ← up to 10 pts
      + min((trafficCalming / km) × 2,   5)   ← up to  5 pts
      − min((roughSurface   / km) × 5,  15)   ← up to −15 pts
      − min((elevation gain / km) × 3,  20)   ← up to −20 pts
      − min((hostileRoads   / km) × 4,  12)   ← up to −12 pts (trunk/primary/motorway)
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
| Map | Leaflet + react-leaflet |
| Tile layers | OpenStreetMap standard + CyclOSM |
| Geocoding | Nominatim + Photon/Komoot autocomplete |
| Routing | OSRM public bike server |
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

---

## Limitations

- **OSRM public server** has no SLA. For production, self-host or use [OpenRouteService](https://openrouteservice.org/) free tier.
- **Overpass API** rate-limits heavy usage. Conservative query: 10 sampled points, 250 m radius.
- **Rate limiting**: 10 requests/minute per IP (in-memory, resets on server restart).
- **Google Maps shortened URLs** (`maps.app.goo.gl`) can't be parsed client-side — use the fallback address fields.
- The Happy Score is a heuristic proxy. Real-world conditions (temporary roadworks, construction) aren't reflected.

---

## License

MIT
