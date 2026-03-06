# Happy Navigator

> Find the happiest bike route between two locations — scored by parks, cycleways, water, and green spaces.

![Happy Navigator screenshot](docs/screenshot.png)

---

## What it does

Given a **start** and **end** location (or a pasted Google Maps directions URL), Happy Navigator:

1. **Geocodes** both addresses via [Nominatim](https://nominatim.openstreetmap.org/) (free, no key required).
2. **Fetches 2–3 route alternatives** from the [OSRM](http://project-osrm.org/) public bike routing server.
3. **Scores each route** by querying [OpenStreetMap Overpass API](https://overpass-api.de/) for nearby:
   - Parks & gardens (`leisure=park`)
   - Green land-use (forests, meadows)
   - Water features (rivers, lakes)
   - Dedicated cycle infrastructure (`highway=cycleway`, `cycleway=lane/track`)
4. **Calls an LLM once** (Anthropic Claude Haiku by default) with a compact JSON summary to:
   - Confirm or pick the best route
   - Write a short, friendly explanation (2–4 bullets)
   - Suggest optional stops (cafés, parks, viewpoints) where relevant
5. **Displays everything** on an interactive Leaflet/OpenStreetMap map with a side panel showing scores, signals, and the AI explanation.

**All external API calls (routing, geocoding, OSM data) are free and open.** Only the AI explanation requires an API key.

---

## Architecture

```
Browser
  └── Next.js App Router (React + Tailwind)
        ├── app/page.tsx              — main UI (search form + map + results panel)
        ├── app/components/
        │     ├── SearchForm.tsx      — address / Google Maps URL input
        │     ├── MapView.tsx         — Leaflet map (dynamically imported, ssr:false)
        │     ├── RoutePanel.tsx      — route cards with scores & AI explanation
        │     └── HappyScore.tsx      — score badge component
        └── app/api/navigate/route.ts — POST handler (all server-side logic)
              ├── lib/nominatim.ts    — geocoding via Nominatim
              ├── lib/osrm.ts         — bike routing via OSRM public server
              ├── lib/overpass.ts     — OSM feature queries (parks, cycleways, water)
              ├── lib/happiness.ts    — weighted scoring formula
              └── lib/parseGoogleMapsUrl.ts — parse Google Maps directions URLs
```

**Key design decisions:**

- **No paid APIs required to run locally** — routing + geocoding + map tiles are all free/open.
- **AI is called once per search**, with a compact JSON payload (~200 tokens input).
- **Overpass queries degrade gracefully** — if they fail or time out, routes are still shown with partial scores.
- **API keys never reach the browser** — the `/api/navigate` route handler is server-only.

---

## Local Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (bundled with Node)
- An **Anthropic API key** (get one at [console.anthropic.com](https://console.anthropic.com/settings/keys))

### 1 — Clone and install

```bash
git clone <YOUR_REPO_URL> happy-navigator
cd happy-navigator
npm install
```

### 2 — Configure environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in your key:

```env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

**Using OpenAI instead?**

```bash
npm install openai   # install the optional package
```

Then set in `.env.local`:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

### 3 — Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **First search takes 10–20 seconds** — it geocodes, fetches routing alternatives, runs parallel Overpass queries, and calls the AI. Subsequent searches are similar (all external APIs).

---

## Usage

**Option A — Type addresses:**

1. Enter a start address (e.g. `Central Park, New York`)
2. Enter an end address (e.g. `Brooklyn Bridge, New York`)
3. Click **Find Happy Routes**

**Option B — Paste a Google Maps URL:**

1. Click the **Paste Maps URL** tab
2. Paste a URL like:
   - `https://www.google.com/maps/dir/Central+Park/Brooklyn+Bridge`
   - `https://www.google.com/maps/dir/?api=1&origin=Central+Park&destination=Brooklyn+Bridge`
3. Click **Find Happy Routes**

If the URL can't be parsed automatically, fill in the fallback address fields below it.

---

## Happy Score formula

```
score = 10                                      ← base (any routable path)
      + min((parks  / distKm) × 12,  30)        ← up to 30 pts
      + min((cycles / distKm) × 10,  25)        ← up to 25 pts
      + min((water  / distKm) × 8,   20)        ← up to 20 pts
      + min((green  / distKm) × 5,   15)        ← up to 15 pts
```

Counts are normalised per km so shorter routes aren't penalised for having fewer total features.

---

## Demo Script (for Loom recording)

1. **Open the app** at `http://localhost:3000`.

2. **Show the empty state** — point out the sidebar and placeholder map.

3. **Type Mode demo:**
   - Start: `Battersea Park, London`
   - End: `Southwark Bridge, London`
   - Click **Find Happy Routes** and narrate the loading state.

4. **Results appear:**
   - Point to the map — 2–3 colored polylines (emerald = best, blue = 2nd, orange = 3rd).
   - Green circle = Start, Red circle = End.
   - Show the side panel: Happy Score badges, distance/time, signal badges (parks, cycleways, water).
   - Read the AI explanation bullets aloud.
   - Click a different route in the side panel — watch the map highlight change.

5. **URL Mode demo (bonus):**
   - Switch to "Paste Maps URL" tab.
   - Paste `https://www.google.com/maps/dir/Vondelpark,+Amsterdam/Rijksmuseum,+Amsterdam`
   - Show it auto-parses and runs.

6. **Wrap up:**
   - Emphasise: 100% open APIs for routing + maps, only AI needs a key.
   - Mention the score formula and Overpass graceful degradation.

---

## GitHub — Initial push

```bash
# In the project root:
git init
git add .
git commit -m "Initial commit: Happy Navigator MVP"
git branch -M main
git remote add origin <REPLACE_WITH_GITHUB_REPO_URL>
git push -u origin main
```

To create a GitHub repo first:

```bash
# With GitHub CLI (https://cli.github.com/):
gh repo create happy-navigator --public --source=. --remote=origin --push
```

---

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `AI_PROVIDER` | No | `anthropic` (default) or `openai` |
| `ANTHROPIC_API_KEY` | Yes (if anthropic) | Anthropic API key |
| `OPENAI_API_KEY` | Yes (if openai) | OpenAI API key |

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v3 |
| Map | Leaflet + react-leaflet |
| Map tiles | OpenStreetMap (free) |
| Geocoding | Nominatim (free, no key) |
| Routing | OSRM public demo server (free, no key) |
| OSM data | Overpass API (free, no key) |
| AI | Anthropic Claude Haiku (cheap — ~$0.001/search) |

---

## Limitations & known constraints

- **OSRM public server** has no SLA and may occasionally be slow. For production, self-host OSRM with a regional `.osm.pbf` extract.
- **Overpass API** rate-limits heavy usage. The app queries conservatively (one compound query per route, 6 sampled points, 200 m radius).
- **Google Maps shortened URLs** (`maps.app.goo.gl/...`) cannot be parsed client-side without following the redirect — fill in addresses manually.
- The Happy Score is a **heuristic proxy** for route pleasantness. Real-world conditions (traffic, road surface, elevation) are not currently considered.

---

## License

MIT
