# Happy Navigator — Project Status

## Done

### Core app
- Next.js 15 App Router + TypeScript strict + Tailwind CSS
- Google Maps JS API (client) — map display, Places Autocomplete with session tokens
- Google Directions API (server) — canoe route alternatives (walking mode, up to 3 routes)
- Google Geocoding API (server) — forward + reverse geocoding
- Overpass (OpenStreetMap) — happiness signal detection along route corridor
- OpenTopoData — elevation gain for portage penalty scoring
- Claude Haiku AI — one call per search, explains why the top route is happiest
- GPX export for selected route
- URL sharing (`?from=&to=` params, auto-search on load)
- Map pin mode — click map to set start/end
- Via-point (waypoint) support
- Recent searches (localStorage)
- Metric/imperial toggle (localStorage)
- Calories + CO₂ savings estimates per route
- Elevation profile chart for selected route

### Scoring
- Weighted 0–100 Happy Score: parks (30), waterways (25), water (20), green (15), calm water (15), lit (10), launches (8), portage (5), base (5)
- Penalties: rapids (−15), elevation (−20), motorboat zones (−12)
- Partial data penalty: 15% reduction, floor 5
- `bestRouteId` always equals top scorer — AI is explanation-only, never overrides ranking

### API & security
- Rate limiting: 10 req/min per IP (in-memory)
- In-memory LRU cache: geocoding (500 entries, 24h TTL), routes (200 entries, 2h TTL)
- Shared `createLRUCache<V>` utility (eliminates duplicated cache code)
- Security headers: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy, Content-Security-Policy
- Separate server-only API key (`GOOGLE_MAPS_SERVER_KEY`) + client key (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`)
- `maxDuration = 30s` on the navigate route (Vercel)

### Testing
- Playwright e2e suite: 87 mocked tests + 2 skipped live smoke tests
  - 01-search-form, 02-loading, 03-results, 04-route-selection, 05-happiest-route, 06-autocomplete, 07-mobile, 08-accessibility, 09-url-sharing
- Vitest unit tests: 67 tests
  - `happiness.ts` — 38 tests (all weights, caps, penalties, partial flag)
  - `parseGoogleMapsUrl.ts` — 17 tests (both URL formats, encoding, edge cases)
  - `overpass.ts` — 12 tests (sampleCoords sampling, first/last guarantee)
- Real API integration suite: 18 tests (`e2e/integration/api.integration.spec.ts`)
  - Hits live Google Maps, Overpass, Anthropic — no mocks
  - Requires dev server + real API keys to run
- `data-testid` attributes on all interactive elements

### CI/CD & deployment
- GitHub Actions: lint → typecheck → Playwright e2e on every push/PR to main
- `vercel.json` with `maxDuration` limits for both API routes
- `soak-loop.ps1` overnight loop: runs real integration tests for 8 hours, stops after 5 consecutive unfixed failures

### Tooling
- 35 slash commands installed in `.claude/commands/` from wshobson/agents:
  `/accessibility-audit`, `/tdd-cycle`, `/tdd-red`, `/tdd-green`, `/tdd-refactor`,
  `/test-generate`, `/error-analysis`, `/security-sast`, `/security-hardening`,
  `/full-review`, `/prompt-optimize`, `/design-review`, `/component-scaffold`,
  `/workflow-automate`, `/tech-debt`, `/deps-audit`, and more
- 36 skill files in `.claude/commands/skills/`

### Accessibility
- `aria-live="assertive"` + `role="alert"` on error banner
- `aria-live="polite"` on loading steps
- `aria-label` on main, metric toggle, pin buttons, comparison strip, score bar, GPX button, AI summary list, suggested stops list
- Route cards: `role="button"`, `aria-pressed`, `aria-label` with score

### Documentation
- `CLAUDE.md` — architecture rules, file map, API constraints, env vars
- `docs/INTEGRATION_TESTS.md` — how to run real API tests + overnight soak

---

## Left to do

### High priority
- **Activate integration tests** — add real API keys to `.env.local`, run `npm run test:integration` for the first time, fix any failures
- **GitHub Actions secrets** — add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `ANTHROPIC_API_KEY` to repo secrets so CI e2e tests pass
- **Restrict API keys** in Google Cloud Console (HTTP referrer restrictions for client key, IP restrictions for server key)

### API modernisation
- **Migrate Directions API → Routes API** — Directions API deprecated March 2025, Routes API is the replacement
- **Switch `@react-google-maps/api` → `@vis.gl/react-google-maps`** — the current library is unmaintained; `@vis.gl` is the official Google-backed replacement

### Features
- **Better mobile experience** — the sidebar takes 46vh on mobile, leaving little room for the map; a bottom-sheet drawer pattern would be cleaner
- **Offline / PWA support** — cache recent routes for offline viewing
- **Route sharing** — generate a short URL or share card (currently only `?from=&to=` coords)
- **Multi-stop routes** — currently supports one via-point; allow a full itinerary
- **Paddling time estimate** — current estimate uses walking duration; a canoe-specific speed (avg 4–5 km/h) would be more accurate
- **Difficulty rating** — surface a human-readable difficulty label (easy/moderate/hard) based on rapids + elevation signals

### Testing
- **Un-skip live smoke tests** (`e2e/smoke/live.spec.ts`) and integrate into CI with real keys
- **Visual regression tests** — Playwright screenshots to catch unintended UI changes
- **Accessibility audit** — run `/accessibility-audit` with axe-core against the live app; currently only basic aria checks

### Performance
- **Overpass query optimisation** — currently samples 10 points with 250m radius; tuning these would reduce data transfer and improve accuracy
- **Route caching** — currently only server-side; add `Cache-Control` headers so the browser/CDN can cache repeated searches
- **Bundle analysis** — `@react-google-maps/api` is large; analyse and tree-shake

### Observability
- **Error tracking** — no Sentry or equivalent; production errors are invisible
- **API latency monitoring** — no metrics on how long each pipeline step takes
