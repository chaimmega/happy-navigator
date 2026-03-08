# Happy Navigator

> Find the happiest canoe route between two locations — scored by waterways, parks, calm water, lighting, portage difficulty, and motorboat traffic.

![Happy Navigator screenshot](docs/screenshot.png)

---

## What it does

Given a **put-in** and **take-out** location (or a pasted Google Maps directions URL), Happy Navigator:

1. **Geocodes** both addresses via [Nominatim](https://nominatim.openstreetmap.org/) (free, no key).
2. **Fetches 2–3 route alternatives** from the [OSRM](http://project-osrm.org/) public foot routing server.
3. **Scores each route** by querying [OpenStreetMap Overpass API](https://overpass-api.de/) for:
   - Parks & gardens (`leisure=park`)
   - Green land-use (forests, meadows, woodland)
   - Water features (rivers, lakes, canals)
   - Dedicated waterways (`waterway=river/canal/stream`)
   - Boat launches and canoe put-in points (`leisure=slipway`, `canoe=put_in`)
   - Portage access points (`portage=yes`)
   - Street lighting (`lit=yes`)
   - **Calm water sections** (lakes, ponds — sheltered paddling)
   - **Rapids penalty** (whitewater rapid grades — difficulty)
   - **Motorboat traffic penalty** (motorboat zones — safety hazard)
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
        │     ├── MapView.tsx         — Leaflet map (Topo tile toggle, map click handler)
        │     ├── RoutePanel.tsx      — route cards, scores, GPX export, AI explanation
        │     ├── ElevationProfile.tsx — SVG elevation chart (metric/imperial)
        │     └── HappyScore.tsx      — score badge component
        └── app/api/
              ├── navigate/route.ts   — POST handler (full scoring pipeline, rate limiting)
              └── reverse/route.ts    — GET handler (reverse geocode for map clicks)
                    ├── lib/nominatim.ts    — geocoding via Nominatim
                    ├── lib/osrm.ts         — canoe routing via OSRM (foot profile)
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
1. Enter put-in/take-out (autocomplete via Photon/Komoot)
2. Use GPS button for current location
3. Click ⇅ to swap put-in and take-out
4. Click **Find Happy Routes**

**Paste a Google Maps URL:**
- `https://www.google.com/maps/dir/Central+Park/Brooklyn+Bridge`
- `https://www.google.com/maps/dir/?api=1&origin=...&destination=...`

**Map pin mode (desktop):**
- Click **📍 Pin start** or **📍 Pin end** in the header to set locations by clicking the map

**Units:** Toggle km/mi in the header (preference saved in localStorage)

**Tile layers:** Click the map layer button to switch between standard OpenStreetMap and **Topo** (topographic map showing terrain)

**Export:** Click **Export GPX** on the selected route to download for GPS devices

**Shareable links:** URL updates with coords after each search — share or bookmark it

**Recent searches:** Stored locally — click "Recent searches" below the form

---

## Happy Score formula

```
score = 5 (base)
      + min((parks     / km) × 12, 30)   ← up to 30 pts
      + min((waterways / km) × 10, 25)   ← up to 25 pts (dedicated waterways)
      + min((water     / km) × 8,  20)   ← up to 20 pts
      + min((green     / km) × 5,  15)   ← up to 15 pts
      + min((calmWater / km) × 6,  15)   ← up to 15 pts  (sheltered/calm sections)
      + min((launch    / km) × 3,   8)   ← up to  8 pts  (boat launches, put-in)
      + min((lit       / km) × 4,  10)   ← up to 10 pts
      + min((portage   / km) × 2,   5)   ← up to  5 pts
      − min((rapids    / km) × 5,  15)   ← up to −15 pts (whitewater difficulty)
      − min((elevation / km) × 3,  20)   ← up to −20 pts (steep portage terrain)
      − min((motorBoat / km) × 4,  12)   ← up to −12 pts (motorboat traffic zones)
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
| Tile layers | OpenStreetMap standard + OpenTopoMap |
| Geocoding | Nominatim + Photon/Komoot autocomplete |
| Routing | OSRM public foot server |
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
- The Happy Score is a heuristic proxy. Real-world conditions (water levels, portage closures) aren't reflected.

---

## License

MIT
