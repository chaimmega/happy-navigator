# Happy Navigator — Full Project Status

**Last updated:** 2026-03-05  
**GitHub:** https://github.com/chaimmega/happy-navigator  
**GitHub account:** chaimmega  
**Local path:** `C:\Users\clevine\GitRepos\HappyNavigator`

---

## Current Status: COMPLETE & ON GITHUB ✅

The full MVP is built, improved, working, and pushed to GitHub.  
`npm run build` → 0 errors. Dev server runs on http://localhost:3000.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 App Router + TypeScript |
| Styling | Tailwind CSS v3 |
| Map | react-leaflet v4 (dynamic import, `ssr: false`) |
| Routing | OSRM public server (free, bike profile) |
| Geocoding | Nominatim (free, OSM-based) |
| Autocomplete | Photon by Komoot (free, CORS-enabled, real-time) |
| OSM signals | Overpass API (parks, water, cycleways, green spaces) |
| AI | Claude Haiku (`claude-haiku-4-5-20251001`) via Anthropic SDK |
| Screenshots | Puppeteer (headless Chrome) |

---

## Complete File Map

```
happy-navigator/
├── app/
│   ├── api/
│   │   └── navigate/
│   │       └── route.ts          ✅ Full pipeline: geocode → route → score → AI
│   ├── components/
│   │   ├── HappyScore.tsx        ✅ Score badge
│   │   ├── MapView.tsx           ✅ Leaflet map (dynamic, ssr:false, memoized)
│   │   ├── PlaceAutocomplete.tsx ✅ Photon autocomplete with "Did you mean?" + "No results"
│   │   ├── RoutePanel.tsx        ✅ Route cards, score bar, AI explanation
│   │   └── SearchForm.tsx        ✅ Uses PlaceAutocomplete, Google Maps URL mode
│   ├── lib/
│   │   ├── constants.ts          ✅ ROUTE_COLORS, ROUTE_LABELS
│   │   ├── happiness.ts          ✅ Weighted score formula + breakdown
│   │   ├── nominatim.ts          ✅ Forward + reverse geocoding, coord-string detection
│   │   ├── osrm.ts               ✅ Bike routes from OSRM public server
│   │   ├── overpass.ts           ✅ OSM signals (graceful degradation)
│   │   ├── parseGoogleMapsUrl.ts ✅ Parses /maps/dir/ and ?api=1&origin= URLs
│   │   └── photon.ts             ✅ Photon autocomplete client
│   ├── types/
│   │   └── index.ts              ✅ All shared types incl. ScoreBreakdown, NavigateRequest
│   ├── globals.css               ✅ Tailwind base + .sidebar-scroll custom scrollbar
│   ├── layout.tsx                ✅
│   └── page.tsx                  ✅ Main page: form + animated loading + map + results
├── scripts/
│   └── screenshot.mjs            ✅ Puppeteer script for app screenshots
├── .env.local                    ✅ EXISTS (not committed) — has real API key
├── .env.local.example            ✅ Committed — template for new devs
├── .gitignore                    ✅
├── CLAUDE.md                     ✅ Architecture rules for Claude Code sessions
├── next.config.ts                ✅ reactStrictMode: false (Leaflet compat)
├── package.json                  ✅ All deps installed
├── README.md                     ✅ Full setup + run instructions
└── tsconfig.json                 ✅
```

---

## Features Built

### Core Pipeline
- Enter start + end as place names or exact addresses
- Photon autocomplete with OSM-type emoji icons (🌳 park, 🚉 station, ☕ cafe, etc.)
- Keyboard navigation in autocomplete (↑↓ Enter Escape)
- "Did you mean?" hint when user closes dropdown without selecting
- "No places found" hint in amber when search returns nothing
- Pre-resolved Photon coords passed to API → skips Nominatim geocoding (faster)
- Paste a Google Maps directions URL instead of typing addresses
- Cancel in-flight requests when a new search is submitted (AbortController)

### Route Scoring
- OSRM returns up to 3 bike route alternatives
- Each route scored via Overpass (parks, cycleways, water, green spaces)
- Happy Score formula (0–100):
  ```
  10 (base)
  + min((parks/km)  × 12,  30)   ← up to 30 pts
  + min((cycles/km) × 10,  25)   ← up to 25 pts
  + min((water/km)  × 8,   20)   ← up to 20 pts
  + min((green/km)  × 5,   15)   ← up to 15 pts
  ```
- Score breakdown shown as colored bar (emerald/violet/sky/lime)

### AI
- Claude Haiku explains WHY the best route is happiest
- 2–4 friendly bullet points + optional suggested stops
- Falls back gracefully if API key missing or call fails

### UI
- Full-screen layout (h-screen, map fills remaining space)
- Animated loading steps (4 stages, 4.5s each)
- Route cards with distance, time, score — click to highlight on map
- Leaflet map with colored polylines (green/blue/orange) + start/end markers
- Route tooltip on hover
- Sidebar custom scrollbar (4px, WebKit + Firefox)
- Error dismiss button
- Green ✓ indicator when place coords are resolved
- Spinner while Photon is searching

### Google Maps URL Support
- Parses `/maps/dir/PlaceA/PlaceB/` format
- Parses `?api=1&origin=...&destination=...` format
- Falls back to manual address fields if URL can't be parsed

---

## Known Architecture Rules (important for future sessions)

- **Leaflet + React Strict Mode = broken** — `reactStrictMode: false` in `next.config.ts` is intentional
- **MapView must stay `dynamic(..., { ssr: false })`** — Leaflet requires browser DOM
- **Geometry is `[lng, lat]`** (OSRM/GeoJSON order) — Leaflet swap happens only in MapView
- **Overpass never throws** — always returns `partial: true` on error, never crashes the pipeline
- **AbortController pattern** used in both PlaceAutocomplete (Photon) and page.tsx (API fetch)
- `GH_CONFIG_DIR` must be `C:\Users\clevine\AppData\Roaming\GitHub CLI` for `gh` CLI in bash

---

## Environment Variables

```env
# .env.local (already exists locally, NOT committed to git)
ANTHROPIC_API_KEY=sk-ant-...

# Optional: use OpenAI instead
# AI_PROVIDER=openai
# OPENAI_API_KEY=sk-...
```

---

## How to Run

```bash
cd C:\Users\clevine\GitRepos\HappyNavigator

# Start dev server
npm run dev
# → http://localhost:3000

# Take screenshots (server must be running)
node scripts/screenshot.mjs

# Build check
npm run build
```

---

## How to Push Future Changes to GitHub

```bash
cd C:\Users\clevine\GitRepos\HappyNavigator
git add <files>
git commit -m "your message"
git push
```

GitHub CLI auth uses keyring — run `gh auth status` to verify.  
If `gh` isn't recognized in a session, set:
```bash
GH_CONFIG_DIR="C:\Users\clevine\AppData\Roaming\GitHub CLI" gh <command>
```

---

## To Resume a Session

1. Open terminal, `cd C:\Users\clevine\GitRepos\HappyNavigator`
2. Start Claude Code: `claude --dangerouslySkipPermissions`
3. Claude will load memory from `.claude/projects/.../memory/MEMORY.md`
4. All context, preferences, and architecture knowledge will be available

---

## Potential Future Enhancements

| Feature | Notes |
|---|---|
| Deploy to Vercel | Connect GitHub repo — one click, env var for API key |
| Elevation penalty | BRouter or OpenTopoData — penalise steep climbs |
| Route caching | Redis/KV so same pair returns instantly |
| Share link | Encode route in URL query string |
| GPX export | Download route for bike GPS devices |
| Mobile layout | Sidebar collapses to bottom sheet |
| More route alternatives | OSRM `alternatives=5` + smarter deduplication |
| Offline tile layer | Use self-hosted tiles for privacy |
