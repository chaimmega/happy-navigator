# Happy Navigator — What To Do Next

Organised by priority. Start at the top.

---

## 🔴 Immediate — Broken Things to Fix

### 1. README.md is outdated
The README was written before several features were added. It needs updating:
- Architecture diagram is missing `PlaceAutocomplete.tsx`, `photon.ts`, `constants.ts`
- No mention of the Photon autocomplete feature
- No mention of "Did you mean?" / "No results" hints
- Broken image link on line 5: `![Happy Navigator screenshot](docs/screenshot.png)` — the `docs/` folder does not exist
- GitHub push instructions at the bottom are now stale (repo already exists)

**Fix:** Rewrite the "What it does" and "Architecture" sections, remove broken image line or replace with a real screenshot.

---

### 2. screenshot.mjs uses old input selectors
The Puppeteer script types into:
```js
page.type('input[placeholder="e.g. Central Park, New York"]', ...)
```
But `SearchForm` now uses `PlaceAutocomplete` which triggers a Photon search and opens a dropdown on each keystroke. Typing programmatically will fire the autocomplete, which may interfere with the submit flow.

**Fix:** Update `scripts/screenshot.mjs` to either:
- Type into the inputs by ID (`#start`, `#end`) and press Escape to dismiss the dropdown before submitting, OR
- Use the Google Maps URL mode instead (no autocomplete involved), OR
- Wait for the dropdown, then select the first result with `page.keyboard.press('ArrowDown')` + `Enter`

---

### 3. CLAUDE.md key file locations table is incomplete
`photon.ts` and `PlaceAutocomplete.tsx` are not listed in the table in `CLAUDE.md`. Any new Claude session loading that file gets an incomplete picture.

**Fix:** Add two rows to the table in CLAUDE.md:
```
app/lib/photon.ts              Photon autocomplete client (searchPlaces)
app/components/PlaceAutocomplete.tsx  Autocomplete UI with Did you mean hints
```

---

## 🟡 Short-term — UX Improvements

### 4. "Use my location" button
Add a GPS button next to the "From" field. On click, calls `navigator.geolocation.getCurrentPosition()`, reverse-geocodes via Nominatim, and pre-fills the start field with coords already resolved (no Photon needed).

**Where:** `PlaceAutocomplete.tsx` or `SearchForm.tsx`
**API:** `navigator.geolocation` (browser, free) + existing `nominatim.ts` reverse geocode

---

### 5. Swap start ↔ end button
A small icon button between the two fields that swaps the From and To values (including coords). Common in route planners (Google Maps, Citymapper, Komoot all have this).

**Where:** `SearchForm.tsx` — add button between the two `PlaceAutocomplete` components

---

### 6. Better "no route" error message
Currently if OSRM finds no route (e.g. two points on different continents, or one in the sea) it returns a generic "No routes found" error. Should tell the user why and suggest checking their locations.

**Where:** `app/api/navigate/route.ts` — improve the 404 error message

---

### 7. Validate same start and end
If start coords === end coords (or very close), show an inline error before even calling the API. Saves a full round-trip.

**Where:** `SearchForm.tsx` or `page.tsx` before fetch

---

### 8. Recent searches (localStorage)
Show the last 3–5 searches as quick-tap suggestions below the form when the inputs are empty. Saves re-typing common routes.

**Where:** New hook `useRecentSearches.ts` + small UI in `SearchForm.tsx`
**Storage:** `localStorage` — no server needed

---

## 🟢 Medium-term — New Features

### 9. Deploy to Vercel (highest ROI)
The app is ready to deploy. One-click from GitHub.

**Steps:**
1. Go to vercel.com → Import project → select `chaimmega/happy-navigator`
2. Add environment variable: `ANTHROPIC_API_KEY=sk-ant-...`
3. Deploy — Vercel auto-detects Next.js

**Note:** `maxDuration = 30` is already set in the API route for Vercel's serverless timeout.
After deploy: update README with the live URL.

---

### 10. Shareable link
Encode the current route result (start name, end name, selected route ID) in the URL so users can share a specific result.

**Implementation:**
- On result: `router.push(?from=Battersea+Park&to=Southwark+Bridge&route=0)`
- On load: read params, auto-submit the search
- `startCoords`/`endCoords` cannot be in the URL (too long) — just re-run the search

**Where:** `app/page.tsx` using Next.js `useSearchParams` + `useRouter`

---

### 11. Mobile layout
Currently the sidebar and map are side by side — on a phone the sidebar is too narrow and the map is unusable.

**Design:**
- Below `md` breakpoint: sidebar becomes a bottom drawer (slides up)
- Map fills the full screen
- Small "Show results" button on the map to pull up the drawer
- Same layout pattern used by Komoot, Google Maps mobile

**Where:** `app/page.tsx` layout + Tailwind responsive classes

---

### 12. GPX export
Let users download the selected route as a `.gpx` file to load into their bike GPS, Strava, Komoot, etc.

**Implementation:**
- Convert `ScoredRoute.geometry` (`[lng, lat][]`) to GPX XML format
- Add a "Download GPX" button in `RoutePanel.tsx`
- Trigger download via a `data:application/xml` blob URL
- No server needed — pure client-side

**Where:** New `app/lib/gpx.ts` export function + button in `RoutePanel.tsx`

---

### 13. In-memory route caching
Same start+end pair always hits all the free APIs again (~15–20s). Cache results server-side so repeat searches return instantly.

**Simple implementation:** `Map<string, NavigateResponse>` in `route.ts` module scope (survives between requests in the same serverless instance, ~5 min in Vercel).

**Better implementation:** Vercel KV (Redis) with a 1-hour TTL. Key = `${startLat},${startLng}→${endLat},${endLng}`.

---

## 🔵 Long-term — Bigger Features

### 14. Elevation / gradient penalty
Flat routes score higher than hilly ones for cycling. Currently the score ignores elevation entirely.

**API options:**
- [Open-Elevation](https://open-elevation.com/) — free, open-source
- [OpenTopoData](https://www.opentopodata.org/) — free, 1 req/s limit
- OSRM already returns `legs[].steps` with node elevations if `steps=true` — no extra API needed

**Score change:** Add a 5th signal `flatness` (up to 10 pts) — penalise routes with high total elevation gain per km.

---

### 15. More route alternatives
OSRM supports `alternatives=true` which can return up to ~5 routes. Currently capped at 3 in `osrm.ts`. With a smarter deduplication step (drop routes that share >80% of geometry) we could surface more genuinely different options.

**Where:** `app/lib/osrm.ts` — change `slice(0, 3)` + add deduplication logic

---

### 16. "Scenic detour" mode
Instead of the fastest/shortest bike route, ask OSRM for a route that explicitly passes through a named park or green area. The user picks the route type: Fastest / Balanced / Most Scenic.

**Implementation:**
- Add a waypoint (park centroid from Overpass) to the OSRM request
- Let the AI suggest the waypoint based on Overpass data

---

### 17. Unit tests
No tests exist yet. Key pure functions to test first:
- `computeHappyScore()` — deterministic, easy to unit test
- `parseGoogleMapsUrl()` — lots of edge cases with different URL formats
- `buildLabel()` in `photon.ts` — various property combinations
- `sampleCoords()` in `overpass.ts` — always includes first and last

**Tool:** Jest or Vitest (both work with Next.js)

---

### 18. Self-hosted OSRM (production only)
The OSRM public demo server has no SLA and is shared globally. For a real product:
- Download a regional `.osm.pbf` extract from Geofabrik
- Run OSRM in Docker: `docker run -p 5000:5000 osrm/osrm-backend`
- Change `OSRM_BASE` in `osrm.ts` to your server

---

## Done ✅

- [x] Place name autocomplete with Photon (280ms debounce, keyboard nav, emoji icons)
- [x] "Did you mean?" hint when dropdown closed without selecting
- [x] "No places found" hint in amber
- [x] Pre-resolved coords bypass Nominatim geocoding
- [x] Google Maps URL parsing (two URL formats)
- [x] OSRM bike routing (up to 3 alternatives)
- [x] Overpass OSM signals (parks, water, cycleways, green)
- [x] Happy Score formula with breakdown bar
- [x] Claude Haiku AI explanation with bullet points + suggested stops
- [x] Leaflet map with colored polylines, Start/End markers, FitBounds
- [x] Animated loading steps
- [x] Route selection synced between sidebar and map
- [x] AbortController to cancel stale requests
- [x] Error banner with dismiss button
- [x] Puppeteer screenshot script
- [x] GitHub repo created and pushed (chaimmega/happy-navigator)
- [x] Full PROGRESS.md and CLAUDE.md documentation
